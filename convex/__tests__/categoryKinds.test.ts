import {
  getCategoryKind,
  isExpenseCategory,
  isIncomeCategory,
  isTransferCategory,
} from '../categoryKinds';

describe('categoryKinds', () => {
  it('defaults missing kind to expense', () => {
    expect(getCategoryKind({ name: 'Groceries' })).toBe('expense');
  });

  it('keeps explicit income kind', () => {
    expect(getCategoryKind({ name: 'Salary', categoryKind: 'income' })).toBe('income');
    expect(isIncomeCategory({ name: 'Salary', categoryKind: 'income' })).toBe(true);
    expect(isExpenseCategory({ name: 'Salary', categoryKind: 'income' })).toBe(false);
  });

  it('detects legacy transfer names as transfer kind', () => {
    expect(getCategoryKind({ name: 'Transfer' })).toBe('transfer');
    expect(isTransferCategory({ name: 'Transfer' })).toBe(true);
  });
});
