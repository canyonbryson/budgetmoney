import { v } from 'convex/values';

import { mutation, query, internalMutation } from './_generated/server';
import { ownerArgs, resolveOwner, type Owner } from './ownership';
import { buildCategoryKindSets, getSettingsForQuery } from './budgets';
import { isExpenseCategory } from './categoryKinds';
import { getPeriodForOffset } from './periods';

const ROLLOVER_MODES = v.union(
  v.literal('none'),
  v.literal('positive'),
  v.literal('negative'),
  v.literal('both')
);

type RolloverMode = 'none' | 'positive' | 'negative' | 'both';

type CategoryDoc = {
  _id: string;
  parentId?: string | null;
  name?: string | null;
  label?: string | null;
  categoryKind?: string | null;
  rolloverMode?: RolloverMode | null;
};

type BudgetDoc = {
  categoryId: string;
  periodStart: string;
  amount: number;
};

type TransactionDoc = {
  _id: string;
  date: string;
  amount: number;
  categoryId?: string | null;
};

type SplitDoc = {
  transactionId: string;
  categoryId: string;
  amount: number;
};

function getPeriodStartAtOffset(anchorDate: string, cycleLengthDays: number, now: Date, offset = 0) {
  return getPeriodForOffset(anchorDate, cycleLengthDays, now, offset).periodStart;
}

function getPeriodWindow(periodStart: string, cycleLengthDays: number) {
  const start = new Date(periodStart);
  return getPeriodForOffset(periodStart, cycleLengthDays, start, 0);
}

function getCategoryDisplayName(category: { name?: string | null; label?: string | null }) {
  return category.name ?? category.label ?? 'Category';
}

export function computeCarryoverOut(mode: RolloverMode, remainingBase: number) {
  if (mode === 'positive') return Math.max(remainingBase, 0);
  if (mode === 'negative') return Math.min(remainingBase, 0);
  if (mode === 'both') return remainingBase;
  return 0;
}

export function computeOverUnderBase(totalBudgetBase: number, totalSpent: number) {
  return totalBudgetBase - totalSpent;
}

export function applyCarryoverToCategoryRows(
  rows: Array<{ categoryId: string; carryoverOut: number }>,
  previousCarryoverByCategory: Map<string, number>
) {
  const nextCarryoverByCategory = new Map(previousCarryoverByCategory);
  const computedRows = rows.map((row) => {
    const carryoverAppliedIn = nextCarryoverByCategory.get(row.categoryId) ?? 0;
    const carryoverRunningTotal = carryoverAppliedIn + row.carryoverOut;
    nextCarryoverByCategory.set(row.categoryId, carryoverRunningTotal);
    return {
      ...row,
      carryoverAppliedIn,
      carryoverRunningTotal,
    };
  });
  const carryoverPositiveTotal = computedRows.reduce(
    (sum, row) => sum + (row.carryoverRunningTotal > 0 ? row.carryoverRunningTotal : 0),
    0
  );
  const carryoverNegativeTotal = computedRows.reduce(
    (sum, row) => sum + (row.carryoverRunningTotal < 0 ? row.carryoverRunningTotal : 0),
    0
  );
  return {
    rows: computedRows,
    carryoverPositiveTotal,
    carryoverNegativeTotal,
    carryoverNetTotal: carryoverPositiveTotal + carryoverNegativeTotal,
    nextCarryoverByCategory,
  };
}

async function getHistoryInputs(ctx: any, owner: Owner) {
  const settings = await getSettingsForQuery(ctx, owner);
  const categories = await ctx.db
    .query('categories')
    .withIndex('by_owner_parent', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .collect();
  const expenseCategories = (categories as CategoryDoc[]).filter((cat) => isExpenseCategory(cat as any));

  const budgets = (await ctx.db
    .query('budgets')
    .withIndex('by_owner_period_category', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .collect()) as BudgetDoc[];

  const transactions = (await ctx.db
    .query('transactions')
    .withIndex('by_owner_date', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .collect()) as TransactionDoc[];

  const splits = (await ctx.db
    .query('transactionSplits')
    .withIndex('by_owner', (q: any) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
    .collect()) as SplitDoc[];

  return { settings, categories: categories as CategoryDoc[], expenseCategories, budgets, transactions, splits };
}

function getEarliestSnapshotPeriodStart(args: {
  settings: { anchorDate: string; cycleLengthDays: number };
  budgets: Array<{ periodStart: string }>;
  transactions: Array<{ date: string }>;
}) {
  const candidates: string[] = [];
  for (const budget of args.budgets) candidates.push(budget.periodStart);
  for (const tx of args.transactions) candidates.push(tx.date);
  if (!candidates.length) return null;

  candidates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const earliestDate = new Date(candidates[0]);
  return getPeriodStartAtOffset(args.settings.anchorDate, args.settings.cycleLengthDays, earliestDate, 0);
}

async function rebuildCycleSnapshotsForOwner(ctx: any, owner: Owner, throughPeriodStart?: string) {
  const { settings, categories, expenseCategories, budgets, transactions, splits } = await getHistoryInputs(ctx, owner);
  const lastClosedPeriodStart =
    throughPeriodStart ??
    getPeriodStartAtOffset(settings.anchorDate, settings.cycleLengthDays, new Date(), -1);
  const firstPeriodStart = getEarliestSnapshotPeriodStart({ settings, budgets, transactions });
  if (!firstPeriodStart) return { firstPeriodStart: null, lastClosedPeriodStart, createdCycles: 0 };
  if (firstPeriodStart > lastClosedPeriodStart) {
    return { firstPeriodStart, lastClosedPeriodStart, createdCycles: 0 };
  }

  const expenseCategoryIds = new Set(expenseCategories.map((cat) => String(cat._id)));
  const categoryById = new Map(categories.map((cat) => [String(cat._id), cat]));
  const kindSets = buildCategoryKindSets(categories as any);
  const carryoverByCategory = new Map<string, number>();
  const now = Date.now();
  let createdCycles = 0;

  for (
    let cycleStart = firstPeriodStart;
    cycleStart <= lastClosedPeriodStart;
    cycleStart = getPeriodStartAtOffset(settings.anchorDate, settings.cycleLengthDays, new Date(cycleStart), 1)
  ) {
    const { periodEnd } = getPeriodWindow(cycleStart, settings.cycleLengthDays);
    const budgetsForPeriod = budgets.filter((budget: BudgetDoc) => budget.periodStart === cycleStart);
    const txForPeriod = transactions.filter(
      (tx: TransactionDoc) => tx.date >= cycleStart && tx.date < periodEnd
    );
    const txIds = new Set(txForPeriod.map((tx: any) => String(tx._id)));

    const splitTotals = new Map<string, number>();
    const splitTxIds = new Set<string>();
    for (const split of splits) {
      const txId = String(split.transactionId);
      if (!txIds.has(txId)) continue;
      const category = categoryById.get(String(split.categoryId));
      if (!category || !category.parentId) continue;
      splitTxIds.add(txId);
      const key = String(split.categoryId);
      splitTotals.set(key, (splitTotals.get(key) ?? 0) + split.amount);
    }

    const spentByCategory = new Map<string, number>();
    for (const tx of txForPeriod) {
      if (!tx.categoryId) continue;
      const category = categoryById.get(String(tx.categoryId));
      if (!category || !isExpenseCategory(category as any)) continue;
      if (category.parentId && splitTxIds.has(String(tx._id))) continue;
      const key = String(tx.categoryId);
      spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + tx.amount);
    }
    for (const [categoryId, amount] of splitTotals.entries()) {
      spentByCategory.set(categoryId, (spentByCategory.get(categoryId) ?? 0) + amount);
    }

    const categoryRows = expenseCategories.map((category) => {
      const categoryId = String(category._id);
      const rolloverMode: RolloverMode = category.rolloverMode ?? 'none';
      const budgetBase =
        budgetsForPeriod.find((budget: BudgetDoc) => String(budget.categoryId) === categoryId)?.amount ?? 0;
      const spent = spentByCategory.get(categoryId) ?? 0;
      const remainingBase = budgetBase - spent;
      const carryoverAppliedIn = carryoverByCategory.get(categoryId) ?? 0;
      const carryoverOut = computeCarryoverOut(rolloverMode, remainingBase);
      const carryoverRunningTotal = carryoverAppliedIn + carryoverOut;
      carryoverByCategory.set(categoryId, carryoverRunningTotal);
      return {
        categoryId,
        categoryName: getCategoryDisplayName(category),
        rolloverMode,
        budgetBase,
        spent,
        remainingBase,
        carryoverAppliedIn,
        carryoverOut,
        carryoverRunningTotal,
      };
    });

    let totalBudgetBase = 0;
    for (const budget of budgetsForPeriod) {
      const categoryId = String(budget.categoryId);
      if (expenseCategoryIds.has(categoryId)) totalBudgetBase += budget.amount;
    }
    const totalSpent = txForPeriod
      .filter((tx: TransactionDoc) => tx.categoryId && kindSets.expenseIds.has(String(tx.categoryId)))
      .reduce((sum: number, tx: TransactionDoc) => sum + tx.amount, 0);
    const overUnderBase = computeOverUnderBase(totalBudgetBase, totalSpent);
    const carryoverPositiveTotal = categoryRows.reduce(
      (sum, row) => sum + (row.carryoverRunningTotal > 0 ? row.carryoverRunningTotal : 0),
      0
    );
    const carryoverNegativeTotal = categoryRows.reduce(
      (sum, row) => sum + (row.carryoverRunningTotal < 0 ? row.carryoverRunningTotal : 0),
      0
    );
    const carryoverNetTotal = carryoverPositiveTotal + carryoverNegativeTotal;

    const existingCycleRows = await ctx.db
      .query('budgetCycleSnapshots')
      .withIndex('by_owner_periodStart', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', cycleStart)
      )
      .collect();
    for (const row of existingCycleRows) await ctx.db.delete(row._id);

    const existingCategoryRows = await ctx.db
      .query('budgetCategoryCycleSnapshots')
      .withIndex('by_owner_period', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', cycleStart)
      )
      .collect();
    for (const row of existingCategoryRows) await ctx.db.delete(row._id);

    await ctx.db.insert('budgetCycleSnapshots', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      periodStart: cycleStart,
      periodEnd,
      periodLengthDays: settings.cycleLengthDays,
      totalBudgetBase,
      totalSpent,
      overUnderBase,
      carryoverPositiveTotal,
      carryoverNegativeTotal,
      carryoverNetTotal,
      createdAt: now,
      updatedAt: now,
    });

    for (const row of categoryRows) {
      const sourceCategory = categoryById.get(row.categoryId);
      if (!sourceCategory) continue;
      await ctx.db.insert('budgetCategoryCycleSnapshots', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        periodStart: cycleStart,
        categoryId: sourceCategory._id,
        categoryName: row.categoryName,
        rolloverMode: row.rolloverMode,
        budgetBase: row.budgetBase,
        spent: row.spent,
        remainingBase: row.remainingBase,
        carryoverAppliedIn: row.carryoverAppliedIn,
        carryoverOut: row.carryoverOut,
        carryoverRunningTotal: row.carryoverRunningTotal,
        createdAt: now,
        updatedAt: now,
      });
    }

    createdCycles += 1;
  }

  return { firstPeriodStart, lastClosedPeriodStart, createdCycles };
}

export const snapshotMissingCycles = internalMutation({
  args: {
    ...ownerArgs,
    throughPeriodStart: v.optional(v.string()),
  },
  returns: v.object({
    firstPeriodStart: v.union(v.string(), v.null()),
    lastClosedPeriodStart: v.string(),
    createdCycles: v.number(),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await rebuildCycleSnapshotsForOwner(ctx, owner, args.throughPeriodStart);
  },
});

export const snapshotSingleCycle = internalMutation({
  args: {
    ...ownerArgs,
    periodStart: v.string(),
  },
  returns: v.object({
    firstPeriodStart: v.union(v.string(), v.null()),
    lastClosedPeriodStart: v.string(),
    createdCycles: v.number(),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await rebuildCycleSnapshotsForOwner(ctx, owner, args.periodStart);
  },
});

export const ensureSnapshots = mutation({
  args: {
    ...ownerArgs,
    throughPeriodStart: v.optional(v.string()),
  },
  returns: v.object({
    firstPeriodStart: v.union(v.string(), v.null()),
    lastClosedPeriodStart: v.string(),
    createdCycles: v.number(),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await rebuildCycleSnapshotsForOwner(ctx, owner, args.throughPeriodStart);
  },
});

export const listCycles = query({
  args: {
    ...ownerArgs,
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.object({
    items: v.array(
      v.object({
        periodStart: v.string(),
        periodEnd: v.string(),
        periodLengthDays: v.number(),
        totalBudgetBase: v.number(),
        totalSpent: v.number(),
        overUnderBase: v.number(),
        carryoverPositiveTotal: v.number(),
        carryoverNegativeTotal: v.number(),
        carryoverNetTotal: v.number(),
      })
    ),
    nextCursor: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const limit = Math.min(Math.max(Math.round(args.limit ?? 12), 1), 60);
    let q = ctx.db
      .query('budgetCycleSnapshots')
      .withIndex('by_owner_periodStart', (ix: any) => {
        let scoped = ix.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId);
        if (args.cursor) scoped = scoped.lt('periodStart', args.cursor);
        return scoped;
      })
      .order('desc');

    const rows = await q.take(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      periodLengthDays: row.periodLengthDays,
      totalBudgetBase: row.totalBudgetBase,
      totalSpent: row.totalSpent,
      overUnderBase: row.overUnderBase,
      carryoverPositiveTotal: row.carryoverPositiveTotal,
      carryoverNegativeTotal: row.carryoverNegativeTotal,
      carryoverNetTotal: row.carryoverNetTotal,
    }));
    const nextCursor = hasMore ? rows[limit].periodStart : undefined;
    return { items, nextCursor };
  },
});

export const getCycleDetails = query({
  args: {
    ...ownerArgs,
    periodStart: v.string(),
  },
  returns: v.object({
    cycle: v.union(
      v.null(),
      v.object({
        periodStart: v.string(),
        periodEnd: v.string(),
        periodLengthDays: v.number(),
        totalBudgetBase: v.number(),
        totalSpent: v.number(),
        overUnderBase: v.number(),
        carryoverPositiveTotal: v.number(),
        carryoverNegativeTotal: v.number(),
        carryoverNetTotal: v.number(),
      })
    ),
    categories: v.array(
      v.object({
        categoryId: v.id('categories'),
        categoryName: v.string(),
        rolloverMode: ROLLOVER_MODES,
        budgetBase: v.number(),
        spent: v.number(),
        remainingBase: v.number(),
        carryoverAppliedIn: v.number(),
        carryoverOut: v.number(),
        carryoverRunningTotal: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const cycle = await ctx.db
      .query('budgetCycleSnapshots')
      .withIndex('by_owner_periodStart', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', args.periodStart)
      )
      .first();
    if (!cycle) {
      return { cycle: null, categories: [] };
    }

    const categories = await ctx.db
      .query('budgetCategoryCycleSnapshots')
      .withIndex('by_owner_period', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', args.periodStart)
      )
      .collect();
    categories.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    return {
      cycle: {
        periodStart: cycle.periodStart,
        periodEnd: cycle.periodEnd,
        periodLengthDays: cycle.periodLengthDays,
        totalBudgetBase: cycle.totalBudgetBase,
        totalSpent: cycle.totalSpent,
        overUnderBase: cycle.overUnderBase,
        carryoverPositiveTotal: cycle.carryoverPositiveTotal,
        carryoverNegativeTotal: cycle.carryoverNegativeTotal,
        carryoverNetTotal: cycle.carryoverNetTotal,
      },
      categories: categories.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        rolloverMode: row.rolloverMode,
        budgetBase: row.budgetBase,
        spent: row.spent,
        remainingBase: row.remainingBase,
        carryoverAppliedIn: row.carryoverAppliedIn,
        carryoverOut: row.carryoverOut,
        carryoverRunningTotal: row.carryoverRunningTotal,
      })),
    };
  },
});

export const backfillSnapshots = mutation({
  args: {
    ...ownerArgs,
    throughPeriodStart: v.optional(v.string()),
  },
  returns: v.object({
    firstPeriodStart: v.union(v.string(), v.null()),
    lastClosedPeriodStart: v.string(),
    createdCycles: v.number(),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await rebuildCycleSnapshotsForOwner(ctx, owner, args.throughPeriodStart);
  },
});

export const addManualCycle = mutation({
  args: {
    ...ownerArgs,
    periodStart: v.string(),
    entries: v.array(
      v.object({
        categoryId: v.id('categories'),
        spent: v.number(),
      })
    ),
  },
  returns: v.object({
    periodStart: v.string(),
    periodEnd: v.string(),
    categoryCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await getSettingsForQuery(ctx, owner);
    const currentPeriodStart = getPeriodStartAtOffset(
      settings.anchorDate,
      settings.cycleLengthDays,
      new Date(),
      0
    );
    if (args.periodStart >= currentPeriodStart) {
      throw new Error('Manual history must be in a prior period.');
    }

    const categories = (await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect()) as CategoryDoc[];
    const expenseCategories = categories.filter((cat) => isExpenseCategory(cat as any));
    const entrySpentByCategory = new Map(
      args.entries.map((entry) => [String(entry.categoryId), Number(entry.spent)])
    );
    if (expenseCategories.length === 0) {
      throw new Error('Create budget categories before adding manual history.');
    }
    for (const category of expenseCategories) {
      const categoryId = String(category._id);
      if (!entrySpentByCategory.has(categoryId)) {
        throw new Error('All expense categories must be included.');
      }
      const spent = entrySpentByCategory.get(categoryId) ?? 0;
      if (!Number.isFinite(spent) || spent < 0) {
        throw new Error('Each category spent amount must be a non-negative number.');
      }
    }

    const budgets = (await ctx.db
      .query('budgets')
      .withIndex('by_owner_period_category', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect()) as BudgetDoc[];
    const targetBudgetMap = new Map(
      budgets
        .filter((budget) => budget.periodStart === args.periodStart)
        .map((budget) => [String(budget.categoryId), budget.amount])
    );
    const currentBudgetMap = new Map(
      budgets
        .filter((budget) => budget.periodStart === currentPeriodStart)
        .map((budget) => [String(budget.categoryId), budget.amount])
    );
    const previousPeriodStart = getPeriodStartAtOffset(
      settings.anchorDate,
      settings.cycleLengthDays,
      new Date(args.periodStart),
      -1
    );
    const previousRows = await ctx.db
      .query('budgetCategoryCycleSnapshots')
      .withIndex('by_owner_period', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', previousPeriodStart)
      )
      .collect();
    const previousCarryoverByCategory = new Map(
      previousRows.map((row: any) => [String(row.categoryId), Number(row.carryoverRunningTotal)])
    );

    const manualRows = expenseCategories.map((category) => {
      const categoryId = String(category._id);
      const budgetBase = targetBudgetMap.get(categoryId) ?? currentBudgetMap.get(categoryId) ?? 0;
      const spent = entrySpentByCategory.get(categoryId) ?? 0;
      const rolloverMode: RolloverMode = category.rolloverMode ?? 'none';
      const remainingBase = budgetBase - spent;
      const carryoverOut = computeCarryoverOut(rolloverMode, remainingBase);
      return {
        categoryId,
        categoryName: getCategoryDisplayName(category),
        rolloverMode,
        budgetBase,
        spent,
        remainingBase,
        carryoverOut,
      };
    });
    const recomputed = applyCarryoverToCategoryRows(
      manualRows.map((row) => ({ categoryId: row.categoryId, carryoverOut: row.carryoverOut })),
      previousCarryoverByCategory
    );
    const recomputedByCategory = new Map(
      recomputed.rows.map((row) => [row.categoryId, row])
    );
    const periodEnd = getPeriodWindow(args.periodStart, settings.cycleLengthDays).periodEnd;
    const totalBudgetBase = manualRows.reduce((sum, row) => sum + row.budgetBase, 0);
    const totalSpent = manualRows.reduce((sum, row) => sum + row.spent, 0);
    const overUnderBase = computeOverUnderBase(totalBudgetBase, totalSpent);
    const now = Date.now();

    const existingCycleRows = await ctx.db
      .query('budgetCycleSnapshots')
      .withIndex('by_owner_periodStart', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', args.periodStart)
      )
      .collect();
    for (const row of existingCycleRows) await ctx.db.delete(row._id);
    const existingCategoryRows = await ctx.db
      .query('budgetCategoryCycleSnapshots')
      .withIndex('by_owner_period', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', args.periodStart)
      )
      .collect();
    for (const row of existingCategoryRows) await ctx.db.delete(row._id);

    await ctx.db.insert('budgetCycleSnapshots', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      periodStart: args.periodStart,
      periodEnd,
      periodLengthDays: settings.cycleLengthDays,
      totalBudgetBase,
      totalSpent,
      overUnderBase,
      carryoverPositiveTotal: recomputed.carryoverPositiveTotal,
      carryoverNegativeTotal: recomputed.carryoverNegativeTotal,
      carryoverNetTotal: recomputed.carryoverNetTotal,
      createdAt: now,
      updatedAt: now,
    });

    for (const row of manualRows) {
      const carryover = recomputedByCategory.get(row.categoryId);
      const sourceCategory = categories.find((category) => String(category._id) === row.categoryId);
      if (!carryover || !sourceCategory) continue;
      await ctx.db.insert('budgetCategoryCycleSnapshots', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        periodStart: args.periodStart,
        categoryId: sourceCategory._id as any,
        categoryName: row.categoryName,
        rolloverMode: row.rolloverMode,
        budgetBase: row.budgetBase,
        spent: row.spent,
        remainingBase: row.remainingBase,
        carryoverAppliedIn: carryover.carryoverAppliedIn,
        carryoverOut: row.carryoverOut,
        carryoverRunningTotal: carryover.carryoverRunningTotal,
        createdAt: now,
        updatedAt: now,
      });
    }

    let runningCarryoverByCategory = recomputed.nextCarryoverByCategory;
    const nextPeriodStart = getPeriodStartAtOffset(
      settings.anchorDate,
      settings.cycleLengthDays,
      new Date(args.periodStart),
      1
    );
    const laterCycles = await ctx.db
      .query('budgetCycleSnapshots')
      .withIndex('by_owner_periodStart', (q: any) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).gte('periodStart', nextPeriodStart)
      )
      .order('asc')
      .collect();
    for (const cycle of laterCycles) {
      const cycleCategoryRows = await ctx.db
        .query('budgetCategoryCycleSnapshots')
        .withIndex('by_owner_period', (q: any) =>
          q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('periodStart', cycle.periodStart)
        )
        .collect();
      const cycleRecomputed = applyCarryoverToCategoryRows(
        cycleCategoryRows.map((row: any) => ({
          categoryId: String(row.categoryId),
          carryoverOut: Number(row.carryoverOut),
        })),
        runningCarryoverByCategory
      );
      const byCategoryId = new Map(
        cycleRecomputed.rows.map((row) => [row.categoryId, row])
      );
      for (const row of cycleCategoryRows) {
        const nextRow = byCategoryId.get(String(row.categoryId));
        if (!nextRow) continue;
        await ctx.db.patch(row._id, {
          carryoverAppliedIn: nextRow.carryoverAppliedIn,
          carryoverRunningTotal: nextRow.carryoverRunningTotal,
          updatedAt: now,
        });
      }
      await ctx.db.patch(cycle._id, {
        carryoverPositiveTotal: cycleRecomputed.carryoverPositiveTotal,
        carryoverNegativeTotal: cycleRecomputed.carryoverNegativeTotal,
        carryoverNetTotal: cycleRecomputed.carryoverNetTotal,
        updatedAt: now,
      });
      runningCarryoverByCategory = cycleRecomputed.nextCarryoverByCategory;
    }

    return {
      periodStart: args.periodStart,
      periodEnd,
      categoryCount: manualRows.length,
    };
  },
});
