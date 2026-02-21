import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner, type Owner } from './ownership';
import { getCategoryKind, normalizeCategoryKind, type CategoryKind } from './categoryKinds';

export const list = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const categories = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    return categories.map((category) => ({
      ...category,
      categoryKind: getCategoryKind(category),
    }));
  },
});

export const bootstrapDefaults = mutation({
  args: ownerArgs,
  handler: async () => {
    return;
  },
});

export async function ensureDefaultIncomeCategoryForOwner(ctx: any, owner: Owner): Promise<string> {
  const existingIncome = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('categoryKind'), 'income')
      )
    )
    .collect();
  const topLevelIncome = existingIncome.find((category: any) => !category.parentId);
  if (topLevelIncome) return topLevelIncome._id;

  const namedIncome = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('name'), 'Income')
      )
    )
    .collect();
  const namedTopLevelIncome = namedIncome.find((category: any) => !category.parentId);
  if (namedTopLevelIncome) {
    const nextKind: CategoryKind = normalizeCategoryKind(namedTopLevelIncome.categoryKind) ?? 'income';
    await ctx.db.patch(namedTopLevelIncome._id, {
      categoryKind: nextKind,
      updatedAt: Date.now(),
    });
    return namedTopLevelIncome._id;
  }

  const now = Date.now();
  return await ctx.db.insert('categories', {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    categoryKind: 'income',
    name: 'Income',
    parentId: undefined,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  });
}

export const ensureIncomeCategory = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await ensureDefaultIncomeCategoryForOwner(ctx, owner);
  },
});

export const create = mutation({
  args: {
    ...ownerArgs,
    name: v.string(),
    parentId: v.optional(v.id('categories')),
    categoryKind: v.optional(
      v.union(v.literal('expense'), v.literal('income'), v.literal('transfer'))
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    const categoryKind = args.categoryKind ?? getCategoryKind({ name: args.name });
    return ctx.db.insert('categories', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      categoryKind,
      name: args.name,
      parentId: args.parentId,
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    ...ownerArgs,
    id: v.id('categories'),
    name: v.string(),
    parentId: v.optional(v.id('categories')),
    categoryKind: v.optional(
      v.union(v.literal('expense'), v.literal('income'), v.literal('transfer'))
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.ownerId !== owner.ownerId || existing.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    if (args.parentId && args.parentId === args.id) {
      throw new Error('Category cannot be its own parent.');
    }
    await ctx.db.patch(args.id, {
      name: args.name,
      parentId: args.parentId,
      categoryKind: args.categoryKind ?? getCategoryKind({ ...existing, name: args.name }),
      updatedAt: Date.now(),
    });
  },
});

export const setRolloverMode = mutation({
  args: {
    ...ownerArgs,
    id: v.id('categories'),
    rolloverMode: v.union(
      v.literal('none'),
      v.literal('positive'),
      v.literal('negative'),
      v.literal('both')
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await setCategoryRolloverModeForOwner(ctx, owner, args.id, args.rolloverMode);
  },
});

export const setCarryoverAdjustment = mutation({
  args: {
    ...ownerArgs,
    id: v.id('categories'),
    carryoverAdjustment: v.number(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const category = await ctx.db.get(args.id);
    if (!category) return;
    if (category.ownerId !== owner.ownerId || category.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    await ctx.db.patch(args.id, {
      carryoverAdjustment: args.carryoverAdjustment,
      updatedAt: Date.now(),
    });
  },
});

export async function setCategoryRolloverModeForOwner(
  ctx: any,
  owner: Owner,
  categoryId: string,
  rolloverMode: 'none' | 'positive' | 'negative' | 'both'
): Promise<null> {
  const category = await ctx.db.get(categoryId);
  if (!category) return null;
  if (category.ownerId !== owner.ownerId || category.ownerType !== owner.ownerType) return null;
  await ctx.db.patch(categoryId, { rolloverMode, updatedAt: Date.now() });
  return null;
}

export const remove = mutation({
  args: {
    ...ownerArgs,
    id: v.id('categories'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await removeCategoryForOwner(ctx, owner, args.id);
  },
});

export async function removeCategoryForOwner(
  ctx: any,
  owner: Owner,
  categoryId: string
): Promise<null> {
  const category = await ctx.db.get(categoryId);
  if (!category) return null;
  if (category.ownerId !== owner.ownerId || category.ownerType !== owner.ownerType) return null;
  if (category.isDefault) throw new Error('Default categories cannot be deleted.');

  const child = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('parentId'), categoryId)
      )
    )
    .first();
  if (child) throw new Error('Delete subcategories first.');

  const linkedBudgets = await ctx.db
    .query('budgets')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('categoryId'), categoryId)
      )
    )
    .collect();
  for (const budget of linkedBudgets) {
    await ctx.db.delete(budget._id);
  }

  const linkedTransactions = await ctx.db
    .query('transactions')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId),
        q.eq(q.field('categoryId'), categoryId)
      )
    )
    .collect();
  const now = Date.now();
  for (const transaction of linkedTransactions) {
    const { _id, _creationTime, categoryId: _categoryId, autoCategoryId: _autoCategoryId, ...rest } =
      transaction;
    await ctx.db.replace(_id, {
      ...rest,
      categorizationSource: 'none',
      confidence: 0,
      isTransfer: false,
      updatedAt: now,
    });
  }

  await ctx.db.delete(categoryId);
  return null;
}
