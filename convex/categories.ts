import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', sub: ['Costco', 'Household', 'Food', 'Eating Out'] },
  { name: 'Bills', sub: ['Utilities', 'Internet', 'Phone'] },
  { name: 'Rent', sub: [] },
  { name: 'Restaurants', sub: [] },
  { name: 'Transportation', sub: ['Gas', 'Ride Share', 'Transit'] },
  { name: 'Entertainment', sub: [] },
  { name: 'Health', sub: [] },
  { name: 'Transfer', sub: [] },
  { name: 'Savings', sub: [] },
  { name: 'Income', sub: [] },
];

export const list = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
  },
});

export const bootstrapDefaults = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const existingDefaults = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('isDefault'), true)
        )
      )
      .collect();
    const byName = new Map<string, any>();
    const byParentName = new Map<string, Map<string, any>>();
    for (const cat of existingDefaults) {
      const childName = cat.name?.trim();
      if (childName) {
        byName.set(childName, cat);
      }
      if (!cat.parentId) continue;
      const parent = existingDefaults.find((p) => p._id === cat.parentId);
      const parentName = parent?.name?.trim();
      if (!parentName || !childName) continue;
      const children = byParentName.get(parentName) ?? new Map<string, any>();
      children.set(childName, cat);
      byParentName.set(parentName, children);
    }

    const now = Date.now();
    for (const top of DEFAULT_CATEGORIES) {
      let topId = byName.get(top.name)?._id;
      if (!topId) {
        topId = await ctx.db.insert('categories', {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          name: top.name,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      const childMap = byParentName.get(top.name) ?? new Map<string, any>();
      for (const sub of top.sub) {
        if (childMap.has(sub)) continue;
        await ctx.db.insert('categories', {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          name: sub,
          parentId: topId,
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

export const create = mutation({
  args: {
    ...ownerArgs,
    name: v.string(),
    parentId: v.optional(v.id('categories')),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    return ctx.db.insert('categories', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
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
    const category = await ctx.db.get(args.id);
    if (!category || category.ownerId !== owner.ownerId || category.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    await ctx.db.patch(args.id, { rolloverMode: args.rolloverMode, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: {
    ...ownerArgs,
    id: v.id('categories'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const category = await ctx.db.get(args.id);
    if (!category || category.ownerId !== owner.ownerId || category.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    if (category.isDefault) {
      throw new Error('Default categories cannot be deleted.');
    }

    const child = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('parentId'), args.id)
        )
      )
      .first();
    if (child) {
      throw new Error('Delete subcategories first.');
    }

    const linkedBudget = await ctx.db
      .query('budgets')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('categoryId'), args.id)
        )
      )
      .first();
    if (linkedBudget) {
      throw new Error('Category has budgets. Remove budgets first.');
    }

    const linkedTransaction = await ctx.db
      .query('transactions')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('categoryId'), args.id)
        )
      )
      .first();
    if (linkedTransaction) {
      throw new Error('Category is used by transactions.');
    }

    await ctx.db.delete(args.id);
  },
});
