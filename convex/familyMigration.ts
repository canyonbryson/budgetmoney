import { MutationCtx } from './_generated/server';
import { Owner } from './ownership';

export const OWNER_SCOPED_TABLES = [
  'plaidItems',
  'plaidAccounts',
  'syncState',
  'transactions',
  'merchantRules',
  'categories',
  'budgets',
  'budgetSettings',
  'budgetCycleSnapshots',
  'budgetCategoryCycleSnapshots',
  'receipts',
  'receiptLineItems',
  'receiptLinks',
  'transactionSplits',
  'recipes',
  'recipeIngredients',
  'mealPlans',
  'mealPlanItems',
  'shoppingListItems',
  'pantryItems',
  'canonicalItems',
  'itemPrices',
  'creditCards',
  'notificationSettings',
  'netWorthBuckets',
  'netWorthSnapshots',
  'devices',
] as const;

export async function migrateOwnerData(ctx: MutationCtx, from: Owner, to: Owner) {
  if (from.ownerType === to.ownerType && from.ownerId === to.ownerId) {
    return;
  }

  for (const table of OWNER_SCOPED_TABLES) {
    const docs = await ctx.db
      .query(table)
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), from.ownerType),
          q.eq(q.field('ownerId'), from.ownerId)
        )
      )
      .collect();
    for (const doc of docs) {
      await ctx.db.patch(doc._id, {
        ownerType: to.ownerType,
        ownerId: to.ownerId,
      });
    }
  }
}
