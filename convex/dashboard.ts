import { query } from './_generated/server';
import { v } from 'convex/values';
import { ownerArgs, resolveOwner, type Owner } from './ownership';
import { buildCategoryKindSets, filterTransactionsForBudgetScope, summarizeTransactionTotalsByKind } from './budgets';
import { isExpenseCategory } from './categoryKinds';
import { formatDate, getCurrentPeriod } from './periods';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

async function ensureSettings(ctx: any, owner: Owner) {
  const existing = await ctx.db
    .query('budgetSettings')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId)
      )
    )
    .first();
  if (existing) return existing;

  const now = new Date();
  const anchorDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    cycleLengthDays: 30,
    anchorDate: formatDate(anchorDate),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const getMonthSummary = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    console.log('[getMonthSummary] args:', args);
    const owner = await resolveOwner(ctx, args);
    console.log('[getMonthSummary] resolved owner:', owner);
    const settings = await ensureSettings(ctx, owner);
    console.log('[getMonthSummary] user settings:', settings);
    const { periodStart, periodEnd } = getCurrentPeriod(settings.anchorDate, settings.cycleLengthDays, new Date());
    console.log('[getMonthSummary] periodStart:', periodStart, 'periodEnd:', periodEnd);

    const allCategories = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    console.log('[getMonthSummary] allCategories:', allCategories.length);

    const categories = allCategories.filter((cat) => isExpenseCategory(cat));
    console.log('[getMonthSummary] expense categories:', categories.length);

    const budgets = await ctx.db
      .query('budgets')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('periodStart'), periodStart)
        )
      )
      .collect();
    console.log('[getMonthSummary] budgets:', budgets.length);

    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .filter((q) => q.and(q.gte(q.field('date'), periodStart), q.lt(q.field('date'), periodEnd)))
      .collect();
    const budgetScopedTransactions = await filterTransactionsForBudgetScope(ctx, owner, transactions);
    console.log('[getMonthSummary] transactions:', transactions.length);

    const transactionIds = new Set(budgetScopedTransactions.map((tx) => tx._id));
    const splits = await ctx.db
      .query('transactionSplits')
      .withIndex('by_owner', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();
    console.log('[getMonthSummary] splits:', splits.length);

    const categoryById = new Map(allCategories.map((cat) => [String(cat._id), cat]));
    const kindSets = buildCategoryKindSets(allCategories as any);
    const splitTotals = new Map<string, number>();
    const splitTransactionIds = new Set<string>();

    for (const split of splits) {
      if (!transactionIds.has(split.transactionId)) continue;
      const category = categoryById.get(String(split.categoryId));
      if (!category?.parentId) continue;
      splitTransactionIds.add(String(split.transactionId));
      splitTotals.set(
        String(split.categoryId),
        (splitTotals.get(String(split.categoryId)) ?? 0) + split.amount
      );
    }

    const spentByCategory = new Map<string, number>();
    for (const tx of budgetScopedTransactions) {
      if (!tx.categoryId) continue;
      const category = categoryById.get(String(tx.categoryId));
      if (!category) continue;
      if (!isExpenseCategory(category)) continue;
      const key = String(tx.categoryId);
      if (category.parentId) {
        if (splitTransactionIds.has(String(tx._id))) continue;
        spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + tx.amount);
      } else {
        spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + tx.amount);
      }
    }

    for (const [categoryId, amount] of splitTotals.entries()) {
      spentByCategory.set(categoryId, (spentByCategory.get(categoryId) ?? 0) + amount);
    }

    const categoriesSummary = categories.map((cat) => {
      const budget = budgets.find((b) => b.categoryId === cat._id);
      const spent = spentByCategory.get(cat._id) ?? 0;
      const budgetAmount = budget?.amount ?? 0;
      const remaining = budgetAmount - spent;
      return {
        categoryId: cat._id,
        parentId: cat.parentId ?? null,
        name: cat.name,
        icon: cat.icon ?? null,
        color: cat.color ?? null,
        spent,
        budgetAmount,
        remaining,
        overBudget: spent > budgetAmount && budgetAmount > 0,
      };
    });

    console.log('[getMonthSummary] categoriesSummary:', categoriesSummary);

    const totals = summarizeTransactionTotalsByKind(
      budgetScopedTransactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
      kindSets
    );
    console.log('[getMonthSummary] kind totals:', totals);
    const totalSpent = totals.expenseTotal;
    const totalBudget = categoriesSummary.reduce((sum, c) => c.parentId ? sum : sum + c.budgetAmount, 0);
    const uncategorizedTransactions = budgetScopedTransactions.filter((tx) => !tx.categoryId);
    const uncategorizedCount = uncategorizedTransactions.length;
    const uncategorizedAmount = uncategorizedTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    const syncStates = await ctx.db
      .query('syncState')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    const lastSyncAt = syncStates.reduce((max, s) => Math.max(max, s.lastSyncAt ?? 0), 0) || undefined;

    console.log('[getMonthSummary] returning result', {
      periodStart,
      periodEnd,
      totalSpent,
      incomeTotal: totals.incomeTotal,
      totalBudget,
      categories: categoriesSummary.length,
      uncategorizedCount,
      uncategorizedAmount,
      lastSyncAt,
    });

    return {
      periodStart,
      periodEnd,
      totalSpent,
      incomeTotal: totals.incomeTotal,
      totalBudget,
      categories: categoriesSummary,
      uncategorizedCount,
      uncategorizedAmount,
      lastSyncAt,
    };
  },
});


export const getBudgetAlerts = query({
  args: {
    ...ownerArgs,
    thresholdPct: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await ensureSettings(ctx, owner);
    const { periodStart, periodEnd } = getCurrentPeriod(
      settings.anchorDate,
      settings.cycleLengthDays,
      new Date()
    );
    const threshold = args.thresholdPct ?? 0.9;

    const allCategories = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    const categoryById = new Map(allCategories.map((cat) => [cat._id, cat]));

    const budgets = await ctx.db
      .query('budgets')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('periodStart'), periodStart)
        )
      )
      .collect();

    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .filter((q) => q.and(q.gte(q.field('date'), periodStart), q.lt(q.field('date'), periodEnd)))
      .collect();
    const budgetScopedTransactions = await filterTransactionsForBudgetScope(ctx, owner, transactions);

    const transactionIds = new Set(budgetScopedTransactions.map((tx) => tx._id));
    const splits = await ctx.db
      .query('transactionSplits')
      .withIndex('by_owner', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();

    const splitTotals = new Map<string, number>();
    const splitTransactionIds = new Set<string>();

    for (const split of splits) {
      if (!transactionIds.has(split.transactionId)) continue;
      const category = categoryById.get(split.categoryId);
      if (!category?.parentId) continue;
      splitTransactionIds.add(String(split.transactionId));
      splitTotals.set(
        String(split.categoryId),
        (splitTotals.get(String(split.categoryId)) ?? 0) + split.amount
      );
    }

    const spentByCategory = new Map<string, number>();
    for (const tx of budgetScopedTransactions) {
      if (!tx.categoryId) continue;
      const category = categoryById.get(tx.categoryId);
      if (!category) continue;
      if (!isExpenseCategory(category)) continue;
      const key = String(tx.categoryId);
      if (category.parentId) {
        if (splitTransactionIds.has(String(tx._id))) continue;
        spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + tx.amount);
      } else {
        spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + tx.amount);
      }
    }

    for (const [categoryId, amount] of splitTotals.entries()) {
      spentByCategory.set(categoryId, (spentByCategory.get(categoryId) ?? 0) + amount);
    }

    const overBudget = budgets
      .map((budget) => {
        const spent = spentByCategory.get(String(budget.categoryId)) ?? 0;
        const pct = budget.amount > 0 ? spent / budget.amount : 0;
        return {
          categoryId: budget.categoryId,
          name: categoryById.get(budget.categoryId)?.name ?? 'Category',
          spent,
          budgetAmount: budget.amount,
          pct,
        };
      })
      .filter((row) => row.budgetAmount > 0 && row.pct > threshold)
      .sort((a, b) => b.pct - a.pct);

    return { thresholdPct: threshold, overBudget };
  },
});

export const getPlannedVsActual = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await ensureSettings(ctx, owner);
    const now = new Date();
    const { periodStart, periodEnd } = getCurrentPeriod(
      settings.anchorDate,
      settings.cycleLengthDays,
      now
    );

    const budgets = await ctx.db
      .query('budgets')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('periodStart'), periodStart)
        )
      )
      .collect();
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

    const allCategories = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    const kindSets = buildCategoryKindSets(allCategories as any);

    const monthTransactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .filter((q) => q.and(q.gte(q.field('date'), periodStart), q.lt(q.field('date'), periodEnd)))
      .collect();
    const budgetScopedMonthTransactions = await filterTransactionsForBudgetScope(ctx, owner, monthTransactions);
    const monthlyActual = summarizeTransactionTotalsByKind(
      budgetScopedMonthTransactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
      kindSets
    ).expenseTotal;

    const weekStartDate = getWeekStart(now);
    const weekStart = formatDate(weekStartDate);
    const weekEnd = formatDate(addDays(weekStartDate, 7));
    const weekTransactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .filter((q) => q.and(q.gte(q.field('date'), weekStart), q.lt(q.field('date'), weekEnd)))
      .collect();
    const budgetScopedWeekTransactions = await filterTransactionsForBudgetScope(ctx, owner, weekTransactions);
    const weeklyActual = summarizeTransactionTotalsByKind(
      budgetScopedWeekTransactions.map((tx) => ({ categoryId: tx.categoryId, amount: tx.amount })),
      kindSets
    ).expenseTotal;

    const weeklyPlanned =
      settings.cycleLengthDays > 0
        ? totalBudget * (7 / settings.cycleLengthDays)
        : totalBudget;

    return {
      periodStart,
      periodEnd,
      weekStart,
      weekEnd,
      weekly: { planned: weeklyPlanned, actual: weeklyActual },
      monthly: { planned: totalBudget, actual: monthlyActual },
    };
  },
});
