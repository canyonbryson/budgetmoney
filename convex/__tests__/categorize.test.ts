import { isIncomeLikeTransaction } from '../categorize';

describe('isIncomeLikeTransaction', () => {
  it('detects plaid income primary categories', () => {
    expect(
      isIncomeLikeTransaction({
        name: 'ACME Payroll',
        amount: 2200,
        personalFinanceCategoryPrimary: 'INCOME',
      })
    ).toBe(true);
  });

  it('detects paycheck keywords', () => {
    expect(
      isIncomeLikeTransaction({
        name: 'Direct Deposit Payroll',
        amount: 1400,
      })
    ).toBe(true);
  });

  it('does not classify transfer-like text as income', () => {
    expect(
      isIncomeLikeTransaction({
        name: 'Transfer from checking',
        amount: 500,
      })
    ).toBe(false);
  });
});
