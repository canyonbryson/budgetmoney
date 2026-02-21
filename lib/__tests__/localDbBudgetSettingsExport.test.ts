import { toImportBudgetSettings } from '../localDb';

describe('toImportBudgetSettings', () => {
  it('keeps only fields accepted by Convex import validator', () => {
    const result = toImportBudgetSettings({
      id: 1,
      cycleLengthDays: 30,
      anchorDate: '2026-02-01',
      monthlyIncome: 4200,
      createdAt: 100,
      updatedAt: 200,
    });

    expect(result).toEqual({
      cycleLengthDays: 30,
      anchorDate: '2026-02-01',
    });
  });

  it('returns undefined when no local budget settings exist', () => {
    expect(toImportBudgetSettings(null)).toBeUndefined();
    expect(toImportBudgetSettings(undefined)).toBeUndefined();
  });
});
