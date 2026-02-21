import { mutation } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';

export const clearAll = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);

    const removeAll = async (table: any) => {
      const docs = await ctx.db
        .query(table)
        .filter((q) =>
          q.and(
            q.eq(q.field('ownerType'), owner.ownerType),
            q.eq(q.field('ownerId'), owner.ownerId)
          )
        )
        .collect();
      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }
    };

    await removeAll('plaidItems');
    await removeAll('plaidAccounts');
    await removeAll('syncState');
    await removeAll('transactions');
    await removeAll('merchantRules');
    await removeAll('categories');
    await removeAll('budgets');
    await removeAll('budgetCycleSnapshots');
    await removeAll('budgetCategoryCycleSnapshots');
    await removeAll('budgetSettings');
    await removeAll('receipts');
    await removeAll('receiptLineItems');
    await removeAll('receiptLinks');
    await removeAll('transactionSplits');
    await removeAll('recipes');
    await removeAll('recipeIngredients');
    await removeAll('mealPlans');
    await removeAll('mealPlanItems');
    await removeAll('shoppingListItems');
    await removeAll('pantryItems');
    await removeAll('canonicalItems');
    await removeAll('itemPrices');
    await removeAll('notificationSettings');
    await removeAll('creditCards');
    await removeAll('netWorthBuckets');
    await removeAll('netWorthSnapshots');
    await removeAll('devices');
  },
});
