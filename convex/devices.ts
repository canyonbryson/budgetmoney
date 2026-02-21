import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner, type Owner } from './ownership';
import { ensureDefaultIncomeCategoryForOwner } from './categories';

async function hasOwnerData(ctx: any, owner: Owner): Promise<boolean> {
  const byOwner = (table: string, indexName: string) =>
    ctx.db
      .query(table)
      .withIndex(indexName, (q: any) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .take(1);

  const [budgets, transactions, recipes, mealPlans, plaidItems] = await Promise.all([
    byOwner('budgets', 'by_owner_period_category'),
    byOwner('transactions', 'by_owner_date'),
    byOwner('recipes', 'by_owner'),
    byOwner('mealPlans', 'by_owner_week'),
    byOwner('plaidItems', 'by_owner'),
  ]);

  return (
    budgets.length > 0 ||
    transactions.length > 0 ||
    recipes.length > 0 ||
    mealPlans.length > 0 ||
    plaidItems.length > 0
  );
}

export async function getDeviceOnboardingStatusForOwner(
  ctx: any,
  owner: Owner
): Promise<{ completed: boolean; onboardingCompletedAt: number | null }> {
  const existing = await ctx.db
    .query('devices')
    .withIndex('by_ownerType_ownerId', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .first();

  if (!existing) {
    const hasExistingData = await hasOwnerData(ctx, owner);
    if (hasExistingData) {
      return {
        completed: true,
        onboardingCompletedAt: null,
      };
    }
  }

  return {
    completed: Boolean(existing?.onboardingCompletedAt),
    onboardingCompletedAt: existing?.onboardingCompletedAt ?? null,
  };
}

export async function markDeviceOnboardingCompleteForOwner(
  ctx: any,
  owner: Owner,
  now: number = Date.now()
): Promise<null> {
  const existing = await ctx.db
    .query('devices')
    .withIndex('by_ownerType_ownerId', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      onboardingCompletedAt: now,
      updatedAt: now,
    });
    await ensureDefaultIncomeCategoryForOwner(ctx, owner);
    return null;
  }

  await ctx.db.insert('devices', {
    deviceId: owner.ownerId,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    onboardingCompletedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await ensureDefaultIncomeCategoryForOwner(ctx, owner);
  return null;
}

export const getOnboardingStatus = query({
  args: ownerArgs,
  returns: v.object({
    completed: v.boolean(),
    onboardingCompletedAt: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await getDeviceOnboardingStatusForOwner(ctx, owner);
  },
});

export const markOnboardingComplete = mutation({
  args: ownerArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await markDeviceOnboardingCompleteForOwner(ctx, owner);
  },
});
