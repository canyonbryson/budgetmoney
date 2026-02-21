import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { ownerArgs, resolveOwner, type Owner } from './ownership';
import { getCategoryKind, isExpenseCategory } from './categoryKinds';
import { formatDate, getCurrentPeriod, getPeriodForOffset } from './periods';
import { resolveIncludeInBudget } from './netWorthUtils';

function buildDefaultSettings(now: Date) {
  const anchorDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    cycleLengthDays: 30,
    anchorDate: formatDate(anchorDate),
  };
}

const ROLLOVER_MODES = v.union(
  v.literal('none'),
  v.literal('positive'),
  v.literal('negative'),
  v.literal('both')
);

type CategoryDisplayFields = {
  name?: string;
  label?: string;
};

export function getCategoryDisplayName(category: CategoryDisplayFields): string {
  return category.name ?? category.label ?? 'Category';
}

export const getSettingsForQuery = async (
  ctx: any,
  owner: Owner,
  now: Date = new Date()
): Promise<{ cycleLengthDays: number; anchorDate: string; monthlyIncome: number }> => {
  const existing = await ctx.db
    .query('budgetSettings')
    .withIndex('by_owner', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .first();
  if (existing) {
    return { cycleLengthDays: existing.cycleLengthDays, anchorDate: existing.anchorDate, monthlyIncome: existing.monthlyIncome ?? 0 };
  }

  return { ...buildDefaultSettings(now), monthlyIncome: 0 };
};

function getBudgetMap(budgets: { categoryId: string; amount: number }[]) {
  return new Map(budgets.map((b) => [b.categoryId, b.amount]));
}

export async function filterTransactionsForBudgetScope<T extends { plaidAccountId?: string | null }>(
  ctx: any,
  owner: Owner,
  transactions: T[]
): Promise<T[]> {
  const accounts = await ctx.db
    .query('plaidAccounts')
    .withIndex('by_owner', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .collect();
  const includeByPlaidAccountId = new Map<string, boolean>(
    accounts.map((account: any) => [
      account.plaidAccountId,
      resolveIncludeInBudget(account),
    ])
  );

  return filterTransactionsByBudgetAccountMap(transactions, includeByPlaidAccountId);
}

export function filterTransactionsByBudgetAccountMap<T extends { plaidAccountId?: string | null }>(
  transactions: T[],
  includeByPlaidAccountId: Map<string, boolean>
): T[] {
  return transactions.filter((tx) => {
    if (!tx.plaidAccountId) return true;
    return includeByPlaidAccountId.get(tx.plaidAccountId) ?? true;
  });
}

type CategoryKindSets = {
  expenseIds: Set<string>;
  incomeIds: Set<string>;
  transferIds: Set<string>;
};

export function buildCategoryKindSets(
  categories: Array<{ _id: string; name?: string | null; categoryKind?: string | null }>
): CategoryKindSets {
  const expenseIds = new Set<string>();
  const incomeIds = new Set<string>();
  const transferIds = new Set<string>();
  for (const category of categories) {
    const id = String(category._id);
    const kind = getCategoryKind(category);
    if (kind === 'income') incomeIds.add(id);
    else if (kind === 'transfer') transferIds.add(id);
    else expenseIds.add(id);
  }
  return { expenseIds, incomeIds, transferIds };
}

export function summarizeTransactionTotalsByKind(
  transactions: Array<{ categoryId?: string | null; amount: number }>,
  kindSets: CategoryKindSets
) {
  let expenseTotal = 0;
  let incomeTotal = 0;
  let transferTotal = 0;
  const expenseByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (!tx.categoryId) continue;
    const key = String(tx.categoryId);
    if (kindSets.incomeIds.has(key)) {
      incomeTotal += tx.amount;
      continue;
    }
    if (kindSets.transferIds.has(key)) {
      transferTotal += tx.amount;
      continue;
    }
    if (kindSets.expenseIds.has(key)) {
      expenseTotal += tx.amount;
      expenseByCategory.set(key, (expenseByCategory.get(key) ?? 0) + tx.amount);
    }
  }
  return { expenseTotal, incomeTotal, transferTotal, expenseByCategory };
}

async function ensureSettingsForWrite(
  ctx: any,
  owner: Owner,
  now: Date = new Date()
) {
  const existing = await ctx.db
    .query('budgetSettings')
    .withIndex('by_owner', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .first();
  if (existing) return existing;

  const defaults = buildDefaultSettings(now);
  const docId = await ctx.db.insert('budgetSettings', {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    cycleLengthDays: defaults.cycleLengthDays,
    anchorDate: defaults.anchorDate,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(docId);
  if (!created) {
    throw new Error('Failed to create budget settings.');
  }
  return created;
}

export const listForCurrentPeriod = query({
  args: ownerArgs,
  returns: v.object({
    periodStart: v.string(),
    items: v.array(
      v.object({
        categoryId: v.id('categories'),
        name: v.string(),
        amount: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await getSettingsForQuery(ctx, owner);
    const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());

    const allCategories = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();
    const categories = allCategories.filter((cat) => isExpenseCategory(cat));

    const budgets = await ctx.db
      .query('budgets')
      .withIndex('by_owner_period_category', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', periodStart)
      )
      .collect();

    const items = categories.map((cat) => {
      const budget = budgets.find((b) => b.categoryId === cat._id);
      return {
        categoryId: cat._id,
        name: getCategoryDisplayName(cat),
        amount: budget?.amount ?? 0,
      };
    });

    return { periodStart, items };
  },
});

export const getHierarchy = query({
  args: ownerArgs,
  returns: v.object({
    periodStart: v.string(),
    items: v.array(
      v.object({
        categoryId: v.id('categories'),
        name: v.string(),
        amount: v.number(),
        rolloverMode: v.optional(ROLLOVER_MODES),
        childTotal: v.number(),
        children: v.array(
          v.object({
            categoryId: v.id('categories'),
            name: v.string(),
            amount: v.number(),
            rolloverMode: v.optional(ROLLOVER_MODES),
          })
        ),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await getSettingsForQuery(ctx, owner);
    const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());

    const allCategories = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();
    const categories = allCategories.filter((cat) => isExpenseCategory(cat));

    const budgets = await ctx.db
      .query('budgets')
      .withIndex('by_owner_period_category', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', periodStart)
      )
      .collect();
    const budgetMap = getBudgetMap(budgets);

    const byParent = new Map<string, typeof categories>();
    for (const cat of categories) {
      if (!cat.parentId) continue;
      const list = byParent.get(String(cat.parentId)) ?? [];
      list.push(cat);
      byParent.set(String(cat.parentId), list);
    }

    const topLevel = categories.filter((cat) => !cat.parentId);
    const items = topLevel.map((cat) => {
      const children = byParent.get(String(cat._id)) ?? [];
      const childItems = children.map((child) => ({
        categoryId: child._id,
        name: getCategoryDisplayName(child),
        amount: budgetMap.get(String(child._id)) ?? 0,
        rolloverMode: child.rolloverMode ?? 'none',
      }));
      const childTotal = childItems.reduce((sum, item) => sum + item.amount, 0);
      return {
        categoryId: cat._id,
        name: getCategoryDisplayName(cat),
        amount: budgetMap.get(String(cat._id)) ?? 0,
        rolloverMode: cat.rolloverMode ?? 'none',
        childTotal,
        children: childItems,
      };
    });

    return { periodStart, items };
  },
});

export const getAllocation = query({
  args: {
    ...ownerArgs,
    parentCategoryId: v.id('categories'),
  },
  returns: v.object({
    periodStart: v.string(),
    parent: v.object({
      categoryId: v.id('categories'),
      name: v.string(),
      amount: v.number(),
      rolloverMode: v.optional(ROLLOVER_MODES),
    }),
    children: v.array(
      v.object({
        categoryId: v.id('categories'),
        name: v.string(),
        amount: v.number(),
        rolloverMode: v.optional(ROLLOVER_MODES),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const parent = await ctx.db.get(args.parentCategoryId);
    if (!parent || parent.ownerId !== owner.ownerId || parent.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    if (!isExpenseCategory(parent)) {
      throw new Error('Budgets can only be set on expense categories.');
    }
    const settings = await getSettingsForQuery(ctx, owner);
    const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());

    const budgets = await ctx.db
      .query('budgets')
      .withIndex('by_owner_period_category', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', periodStart)
      )
      .collect();
    const budgetMap = getBudgetMap(budgets);

    const children = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('parentId', parent._id)
      )
      .collect();
    const expenseChildren = children.filter((child) => isExpenseCategory(child));

    return {
      periodStart,
      parent: {
        categoryId: parent._id,
        name: getCategoryDisplayName(parent),
        amount: budgetMap.get(String(parent._id)) ?? 0,
        rolloverMode: parent.rolloverMode ?? 'none',
      },
      children: expenseChildren.map((child) => ({
        categoryId: child._id,
        name: getCategoryDisplayName(child),
        amount: budgetMap.get(String(child._id)) ?? 0,
        rolloverMode: child.rolloverMode ?? 'none',
      })),
    };
  },
});

export const getSettings = query({
  args: ownerArgs,
  returns: v.object({
    cycleLengthDays: v.number(),
    anchorDate: v.string(),
    monthlyIncome: v.number(),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await getSettingsForQuery(ctx, owner);
  },
});

export const updateSettings = mutation({
  args: {
    ...ownerArgs,
    cycleLengthDays: v.number(),
    anchorDate: v.string(),
    monthlyIncome: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await ensureSettingsForWrite(ctx, owner);
    if (!Number.isFinite(args.cycleLengthDays) || args.cycleLengthDays < 1) {
      throw new Error('Cycle length must be at least 1 day.');
    }
    const parsed = Date.parse(args.anchorDate);
    if (Number.isNaN(parsed)) {
      throw new Error('Anchor date must be valid (YYYY-MM-DD).');
    }
    const patch: Record<string, any> = {
      cycleLengthDays: Math.round(args.cycleLengthDays),
      anchorDate: args.anchorDate,
      updatedAt: Date.now(),
    };
    if (args.monthlyIncome !== undefined) {
      patch.monthlyIncome = args.monthlyIncome;
    }
    await ctx.db.patch(settings._id, patch);
    return null;
  },
});

export const upsert = mutation({
  args: {
    ...ownerArgs,
    categoryId: v.id('categories'),
    amount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.ownerId !== owner.ownerId || category.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    if (!isExpenseCategory(category)) {
      throw new Error('Budgets can only be set on expense categories.');
    }
    const settings = await ensureSettingsForWrite(ctx, owner);
    const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
    const now = Date.now();

    const existing = await ctx.db
      .query('budgets')
      .withIndex('by_owner_period_category', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('periodStart', periodStart)
          .eq('categoryId', args.categoryId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { amount: args.amount, updatedAt: now });
      return null;
    }

    await ctx.db.insert('budgets', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      categoryId: args.categoryId,
      periodStart,
      periodLengthDays: settings.cycleLengthDays,
      amount: args.amount,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const updateAllocations = mutation({
  args: {
    ...ownerArgs,
    parentCategoryId: v.id('categories'),
    parentAmount: v.number(),
    allocations: v.array(
      v.object({
        categoryId: v.id('categories'),
        amount: v.number(),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const parent = await ctx.db.get(args.parentCategoryId);
    if (!parent || parent.ownerId !== owner.ownerId || parent.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    if (!isExpenseCategory(parent)) {
      throw new Error('Budgets can only be set on expense categories.');
    }
    if (!Number.isFinite(args.parentAmount)) {
      throw new Error('Parent amount must be a number.');
    }

    const children = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('parentId', parent._id)
      )
      .collect();
    const expenseChildren = children.filter((child) => isExpenseCategory(child));

    const childIds = new Set(expenseChildren.map((child) => String(child._id)));
    const allocations = args.allocations;
    if (allocations.length !== expenseChildren.length) {
      throw new Error('All subcategories must be allocated.');
    }
    for (const alloc of allocations) {
      if (!childIds.has(String(alloc.categoryId))) {
        throw new Error('Allocation contains invalid subcategory.');
      }
      if (!Number.isFinite(alloc.amount)) {
        throw new Error('Allocation amount must be a number.');
      }
    }

    const sum = allocations.reduce((total, alloc) => total + alloc.amount, 0);
    if (Math.abs(sum - args.parentAmount) > 0.01) {
      throw new Error('Subcategory totals must match the parent budget.');
    }

    const settings = await ensureSettingsForWrite(ctx, owner);
    const { periodStart } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
    const now = Date.now();

    const upsertBudget = async (categoryId: Id<'categories'>, amount: number) => {
      const existing = await ctx.db
        .query('budgets')
        .withIndex('by_owner_period_category', (q) =>
          q
            .eq('ownerType', owner.ownerType)
            .eq('ownerId', owner.ownerId)
            .eq('periodStart', periodStart)
            .eq('categoryId', categoryId)
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { amount, updatedAt: now });
        return;
      }
      await ctx.db.insert('budgets', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        categoryId,
        periodStart,
        periodLengthDays: settings.cycleLengthDays,
        amount,
        createdAt: now,
        updatedAt: now,
      });
    };

    await upsertBudget(parent._id, args.parentAmount);
    for (const alloc of allocations) {
      await upsertBudget(alloc.categoryId, alloc.amount);
    }

    return null;
  },
});

export const getFullHierarchy = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await getSettingsForQuery(ctx, owner);
    const { periodStart, periodEnd } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
    const { periodStart: previousPeriodStart } = getPeriodForOffset(
      settings.anchorDate,
      settings.cycleLengthDays,
      new Date(periodStart),
      -1
    );

    const allCategories = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();
    const kindSets = buildCategoryKindSets(allCategories as any);
    const categories = allCategories.filter((cat) => isExpenseCategory(cat));

    const budgets = await ctx.db
      .query('budgets')
      .withIndex('by_owner_period_category', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', periodStart)
      )
      .collect();
    const budgetMap = getBudgetMap(budgets);
    const carryoverRows = await ctx.db
      .query('budgetCategoryCycleSnapshots')
      .withIndex('by_owner_period', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', previousPeriodStart)
      )
      .collect();
    const carryoverMap = new Map(
      carryoverRows.map((row: any) => [String(row.categoryId), row.carryoverRunningTotal as number])
    );

    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .filter((q: any) => q.and(q.gte(q.field('date'), periodStart), q.lt(q.field('date'), periodEnd)))
      .collect();
    const budgetScopedTransactions = await filterTransactionsForBudgetScope(ctx, owner, transactions);

    const totals = summarizeTransactionTotalsByKind(
      budgetScopedTransactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
      kindSets
    );
    const spentByCategory = totals.expenseByCategory;

    const byParent = new Map<string, typeof categories>();
    for (const cat of categories) {
      if (!cat.parentId) continue;
      const list = byParent.get(String(cat.parentId)) ?? [];
      list.push(cat);
      byParent.set(String(cat.parentId), list);
    }

    const topLevel = categories.filter((cat) => !cat.parentId);
    const items = topLevel.map((cat) => {
      const children = byParent.get(String(cat._id)) ?? [];
      const childItems = children.map((child) => ({
        categoryId: child._id,
        name: getCategoryDisplayName(child),
        amount: budgetMap.get(String(child._id)) ?? 0,
        spent: spentByCategory.get(String(child._id)) ?? 0,
        rolloverMode: child.rolloverMode ?? 'none',
        carryoverBase: carryoverMap.get(String(child._id)) ?? 0,
        carryoverAdjustment: child.carryoverAdjustment ?? 0,
        carryoverCurrent: (carryoverMap.get(String(child._id)) ?? 0) + (child.carryoverAdjustment ?? 0),
      }));
      const childTotal = childItems.reduce((sum, item) => sum + item.amount, 0);
      const childSpentTotal = childItems.reduce((sum, item) => sum + item.spent, 0);
      const carryoverBase = carryoverMap.get(String(cat._id)) ?? 0;
      const carryoverAdjustment = cat.carryoverAdjustment ?? 0;
      return {
        categoryId: cat._id,
        name: getCategoryDisplayName(cat),
        amount: budgetMap.get(String(cat._id)) ?? 0,
        spent: (spentByCategory.get(String(cat._id)) ?? 0) + childSpentTotal,
        rolloverMode: cat.rolloverMode ?? 'none',
        carryoverBase,
        carryoverAdjustment,
        carryoverCurrent: carryoverBase + carryoverAdjustment,
        childTotal,
        children: childItems,
      };
    });

    return {
      periodStart,
      periodEnd,
      monthlyIncome: settings.monthlyIncome,
      incomeTotal: totals.incomeTotal,
      items,
    };
  },
});
