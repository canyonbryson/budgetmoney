import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Id } from './_generated/dataModel';
import { ownerArgs, resolveOwner } from './ownership';

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentPeriod(anchorDate: string, cycleLengthDays: number, now: Date) {
  const anchor = new Date(anchorDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((now.getTime() - anchor.getTime()) / msPerDay);
  const periods = Math.floor(Math.max(diffDays, 0) / cycleLengthDays);
  const periodStart = new Date(anchor.getTime() + periods * cycleLengthDays * msPerDay);
  const periodEnd = new Date(periodStart.getTime() + cycleLengthDays * msPerDay);
  return { periodStart: formatDate(periodStart), periodEnd: formatDate(periodEnd) };
}

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
  owner: { ownerType: 'device' | 'user'; ownerId: string },
  now: Date = new Date()
): Promise<{ cycleLengthDays: number; anchorDate: string }> => {
  const existing = await ctx.db
    .query('budgetSettings')
    .withIndex('by_owner', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .first();
  if (existing) {
    return { cycleLengthDays: existing.cycleLengthDays, anchorDate: existing.anchorDate };
  }

  return buildDefaultSettings(now);
};

function getBudgetMap(budgets: { categoryId: string; amount: number }[]) {
  return new Map(budgets.map((b) => [b.categoryId, b.amount]));
}

async function ensureSettingsForWrite(
  ctx: any,
  owner: { ownerType: 'device' | 'user'; ownerId: string },
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

    const categories = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();

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

    const categories = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();

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

    return {
      periodStart,
      parent: {
        categoryId: parent._id,
        name: getCategoryDisplayName(parent),
        amount: budgetMap.get(String(parent._id)) ?? 0,
        rolloverMode: parent.rolloverMode ?? 'none',
      },
      children: children.map((child) => ({
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
    await ctx.db.patch(settings._id, {
      cycleLengthDays: Math.round(args.cycleLengthDays),
      anchorDate: args.anchorDate,
      updatedAt: Date.now(),
    });
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
    if (!Number.isFinite(args.parentAmount)) {
      throw new Error('Parent amount must be a number.');
    }

    const children = await ctx.db
      .query('categories')
      .withIndex('by_owner_parent', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('parentId', parent._id)
      )
      .collect();

    const childIds = new Set(children.map((child) => String(child._id)));
    const allocations = args.allocations;
    if (allocations.length !== children.length) {
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
