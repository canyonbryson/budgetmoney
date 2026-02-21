import {
  buildLocalCategoryKindSets,
  summarizeLocalTransactionsByKind,
} from '../localDb';

describe('localDb income-aware summary helpers', () => {
  it('separates expense and income totals', () => {
    const kindSets = buildLocalCategoryKindSets([
      { id: 'cat_expense', name: 'Rent', categoryKind: 'expense' },
      { id: 'cat_income', name: 'Income', categoryKind: 'income' },
    ]);
    const totals = summarizeLocalTransactionsByKind(
      [
        { categoryId: 'cat_expense', amount: 1200 },
        { categoryId: 'cat_income', amount: 2600 },
      ],
      kindSets
    );
    expect(totals.expenseTotal).toBe(1200);
    expect(totals.incomeTotal).toBe(2600);
  });
});
