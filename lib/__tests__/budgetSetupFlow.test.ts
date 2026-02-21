import {
  DEFAULT_BUDGET_CYCLE_DAYS,
  decodeSetupState,
  encodeSetupState,
  getDefaultSetupState,
  cycleLengthForType,
  cycleTypeForLength,
  computeHardSyncDiff,
  getNextBudgetSetupStep,
  getPreviousBudgetSetupStep,
  getBudgetSetupStepPath,
  type BudgetSetupState,
} from '../budgetSetupFlow';

describe('budgetSetupFlow', () => {
  it('builds starter defaults with monthly cycle', () => {
    const state = getDefaultSetupState();
    expect(state.cycleLengthDays).toBe(DEFAULT_BUDGET_CYCLE_DAYS);
    expect(state.categories.length).toBeGreaterThan(0);
    expect(state.mode).toBe('create');
    expect(state.cycleType).toBe('monthly');
    expect(state.incomePerCycle).toBe(0);
  });

  it('uses empty categories for no-template default', () => {
    const state = getDefaultSetupState('none');
    expect(state.categories).toEqual([]);
  });

  it('default categories include subcategories array and rolloverMode', () => {
    const state = getDefaultSetupState();
    for (const cat of state.categories) {
      expect(cat.subcategories).toEqual([]);
      expect(cat.rolloverMode).toBe('none');
    }
  });

  it('round-trips encoded state with new fields', () => {
    const source: BudgetSetupState = {
      mode: 'edit',
      templateId: 'none',
      cycleType: 'biweekly',
      cycleLengthDays: 14,
      anchorDate: '2026-02-01',
      incomePerCycle: 3000,
      categories: [
        {
          name: 'Rent',
          amount: 1200,
          existingId: 'cat_1',
          rolloverMode: 'none',
          subcategories: [],
        },
        {
          name: 'Groceries',
          amount: 450,
          existingId: 'cat_2',
          rolloverMode: 'negative',
          subcategories: [
            { name: 'Produce', amount: 150, existingId: 'sub_1', rolloverMode: 'none' },
            { name: 'Meat', amount: 300, rolloverMode: 'positive' },
          ],
        },
      ],
      originalCategoryIds: ['cat_1', 'cat_2', 'sub_1', 'cat_old'],
    };
    const encoded = encodeSetupState(source);
    const decoded = decodeSetupState(encoded);
    expect(decoded).toEqual(source);
  });

  it('decodes legacy state without new fields', () => {
    const legacy = JSON.stringify({
      templateId: 'none',
      cycleLengthDays: 30,
      anchorDate: '2026-02-01',
      categories: [
        { name: 'Rent', amount: 1200 },
        { name: 'Groceries', amount: 450 },
      ],
    });
    const decoded = decodeSetupState(legacy);
    expect(decoded.mode).toBe('create');
    expect(decoded.cycleType).toBe('monthly');
    expect(decoded.incomePerCycle).toBe(0);
    expect(decoded.categories[0].rolloverMode).toBe('none');
    expect(decoded.categories[0].subcategories).toEqual([]);
  });

  it('falls back safely on bad payload', () => {
    const decoded = decodeSetupState('{bad json');
    expect(decoded.cycleLengthDays).toBe(DEFAULT_BUDGET_CYCLE_DAYS);
    expect(Array.isArray(decoded.categories)).toBe(true);
    expect(decoded.mode).toBe('create');
  });

  describe('cycle presets', () => {
    it('maps cycle types to lengths', () => {
      expect(cycleLengthForType('monthly')).toBe(30);
      expect(cycleLengthForType('semiMonthly')).toBe(15);
      expect(cycleLengthForType('biweekly')).toBe(14);
    });

    it('maps lengths to cycle types', () => {
      expect(cycleTypeForLength(30)).toBe('monthly');
      expect(cycleTypeForLength(15)).toBe('semiMonthly');
      expect(cycleTypeForLength(14)).toBe('biweekly');
      expect(cycleTypeForLength(7)).toBe('biweekly');
      expect(cycleTypeForLength(60)).toBe('monthly');
    });
  });

  describe('computeHardSyncDiff', () => {
    it('detects creates, updates, and deletes', () => {
      const state: BudgetSetupState = {
        mode: 'edit',
        templateId: 'none',
        cycleType: 'monthly',
        cycleLengthDays: 30,
        anchorDate: '2026-02-01',
        incomePerCycle: 5000,
        categories: [
          {
            name: 'Rent',
            amount: 1200,
            existingId: 'cat_1',
            rolloverMode: 'none',
            subcategories: [],
          },
          {
            name: 'New Category',
            amount: 300,
            rolloverMode: 'positive',
            subcategories: [
              { name: 'Sub A', amount: 200, rolloverMode: 'none' },
            ],
          },
        ],
        originalCategoryIds: ['cat_1', 'cat_2', 'cat_3'],
      };

      const diff = computeHardSyncDiff(state);
      expect(diff.updates).toEqual([
        { existingId: 'cat_1', name: 'Rent', amount: 1200, rolloverMode: 'none' },
      ]);
      expect(diff.creates).toEqual([
        { name: 'New Category', amount: 300, rolloverMode: 'positive' },
        { name: 'Sub A', parentName: 'New Category', amount: 200, rolloverMode: 'none' },
      ]);
      expect(diff.deletes).toEqual(expect.arrayContaining(['cat_2', 'cat_3']));
      expect(diff.deletes).toHaveLength(2);
    });

    it('returns no deletes in create mode', () => {
      const state = getDefaultSetupState();
      const diff = computeHardSyncDiff(state);
      expect(diff.deletes).toEqual([]);
    });

    it('includes parent existing id for existing subcategory updates', () => {
      const state: BudgetSetupState = {
        mode: 'edit',
        templateId: 'none',
        cycleType: 'monthly',
        cycleLengthDays: 30,
        anchorDate: '2026-02-01',
        incomePerCycle: 5000,
        categories: [
          {
            name: 'Groceries',
            amount: 500,
            existingId: 'cat_1',
            rolloverMode: 'none',
            subcategories: [
              {
                name: 'Produce',
                amount: 200,
                existingId: 'sub_1',
                rolloverMode: 'positive',
              },
              {
                name: 'Dairy',
                amount: 100,
                rolloverMode: 'none',
              },
            ],
          },
        ],
        originalCategoryIds: ['cat_1', 'sub_1'],
      };

      const diff = computeHardSyncDiff(state);
      expect(diff.updates).toEqual(
        expect.arrayContaining([
          {
            existingId: 'sub_1',
            name: 'Produce',
            amount: 200,
            rolloverMode: 'positive',
            parentExistingId: 'cat_1',
          },
        ]),
      );
    });
  });

  describe('wizard step navigation', () => {
    it('returns correct next step for each stage', () => {
      expect(getNextBudgetSetupStep('cycle')).toBe('income');
      expect(getNextBudgetSetupStep('income')).toBe('categories');
      expect(getNextBudgetSetupStep('categories')).toBe('allocation');
      expect(getNextBudgetSetupStep('allocation')).toBe('carryover');
      expect(getNextBudgetSetupStep('carryover')).toBe('review');
      expect(getNextBudgetSetupStep('review')).toBeNull();
    });

    it('returns correct previous step for each stage', () => {
      expect(getPreviousBudgetSetupStep('cycle')).toBeNull();
      expect(getPreviousBudgetSetupStep('income')).toBe('cycle');
      expect(getPreviousBudgetSetupStep('categories')).toBe('income');
      expect(getPreviousBudgetSetupStep('allocation')).toBe('categories');
      expect(getPreviousBudgetSetupStep('carryover')).toBe('allocation');
      expect(getPreviousBudgetSetupStep('review')).toBe('carryover');
    });

    it('maps every step to its route path', () => {
      expect(getBudgetSetupStepPath('cycle')).toBe('/(screens)/budget-setup/cycle');
      expect(getBudgetSetupStepPath('income')).toBe('/(screens)/budget-setup/income');
      expect(getBudgetSetupStepPath('categories')).toBe('/(screens)/budget-setup/categories');
      expect(getBudgetSetupStepPath('allocation')).toBe('/(screens)/budget-setup/allocation');
      expect(getBudgetSetupStepPath('carryover')).toBe('/(screens)/budget-setup/carryover');
      expect(getBudgetSetupStepPath('review')).toBe('/(screens)/budget-setup/review');
    });
  });
});
