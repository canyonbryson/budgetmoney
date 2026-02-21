import { projectPrincipal } from '../netWorth';
import { filterTransactionsByBudgetAccountMap } from '../budgets';

describe('net worth math helpers', () => {
  it('projects principal using monthly compounding', () => {
    expect(projectPrincipal(1000, 0, 12)).toBe(1000);
    const projected = projectPrincipal(1000, 12, 12);
    expect(projected).toBeGreaterThan(1120);
    expect(projected).toBeLessThan(1127);
  });

  it('filters transactions to budget-included accounts', () => {
    const filtered = filterTransactionsByBudgetAccountMap(
      [
        { plaidAccountId: 'checking-1' },
        { plaidAccountId: 'savings-1' },
        { plaidAccountId: 'investment-1' },
        { plaidAccountId: null },
      ],
      new Map([
        ['checking-1', true],
        ['savings-1', false],
        ['investment-1', false],
      ])
    );
    expect(filtered).toEqual([
      { plaidAccountId: 'checking-1' },
      { plaidAccountId: null },
    ]);
  });
});
