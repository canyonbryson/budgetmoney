export const CATEGORY_KINDS = ['expense', 'income', 'transfer'] as const;

export type CategoryKind = (typeof CATEGORY_KINDS)[number];

type CategoryLike = {
  name?: string | null;
  categoryKind?: string | null;
};

export function normalizeCategoryKind(kind?: string | null): CategoryKind | null {
  if (kind === 'expense' || kind === 'income' || kind === 'transfer') {
    return kind;
  }
  return null;
}

export function getCategoryKind(category: CategoryLike): CategoryKind {
  const explicit = normalizeCategoryKind(category.categoryKind);
  if (explicit) return explicit;
  const normalizedName = (category.name ?? '').trim().toLowerCase();
  if (normalizedName === 'transfer') return 'transfer';
  if (normalizedName === 'income') return 'income';
  return 'expense';
}

export function isExpenseCategory(category: CategoryLike): boolean {
  return getCategoryKind(category) === 'expense';
}

export function isIncomeCategory(category: CategoryLike): boolean {
  return getCategoryKind(category) === 'income';
}

export function isTransferCategory(category: CategoryLike): boolean {
  return getCategoryKind(category) === 'transfer';
}
