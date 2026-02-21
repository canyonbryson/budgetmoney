import {
  buildCategoryKindSets,
  getCategoryDisplayName,
  getSettingsForQuery,
  summarizeTransactionTotalsByKind,
} from '../budgets';

describe('getCategoryDisplayName', () => {
  it('falls back to label or default when name missing', () => {
    expect(getCategoryDisplayName({ name: 'Groceries' })).toBe('Groceries');
    expect(getCategoryDisplayName({ label: 'Food' })).toBe('Food');
    expect(getCategoryDisplayName({})).toBe('Category');
  });
});

describe('getSettingsForQuery', () => {
  it('returns defaults when settings missing', async () => {
    const now = new Date('2026-02-08T12:00:00.000Z');
    const expectedAnchor = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const queryMock = {
      withIndex: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
    const ctx = {
      db: {
        query: jest.fn().mockReturnValue(queryMock),
      },
    };
    const owner = { ownerType: 'device' as const, ownerId: 'device-1' };

    await expect(getSettingsForQuery(ctx, owner, now)).resolves.toEqual({
      cycleLengthDays: 30,
      anchorDate: expectedAnchor,
      monthlyIncome: 0,
    });
  });
});

describe('summarizeTransactionTotalsByKind', () => {
  it('tracks expense spending separately from income', () => {
    const kindSets = buildCategoryKindSets([
      { _id: 'cat_expense', name: 'Groceries', categoryKind: 'expense' },
      { _id: 'cat_income', name: 'Income', categoryKind: 'income' },
      { _id: 'cat_transfer', name: 'Transfer', categoryKind: 'transfer' },
    ]);
    const totals = summarizeTransactionTotalsByKind(
      [
        { categoryId: 'cat_expense', amount: 200 },
        { categoryId: 'cat_income', amount: 1800 },
        { categoryId: 'cat_transfer', amount: 300 },
      ],
      kindSets
    );

    expect(totals.expenseTotal).toBe(200);
    expect(totals.incomeTotal).toBe(1800);
    expect(totals.transferTotal).toBe(300);
  });
});
