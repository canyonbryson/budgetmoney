import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';

async function getByItemForOwner(
  ctx: { db: any },
  args: {
    ownerType: 'device' | 'user' | 'family';
    ownerId: string;
    plaidItemIdRef: any;
  }
) {
  const existing = await ctx.db
    .query('syncState')
    .withIndex('by_item', (q: any) => q.eq('plaidItemIdRef', args.plaidItemIdRef))
    .first();
  if (!existing) return null;
  if (existing.ownerType !== args.ownerType || existing.ownerId !== args.ownerId) return null;
  return existing;
}

async function upsertForOwner(
  ctx: { db: any },
  args: {
    ownerType: 'device' | 'user' | 'family';
    ownerId: string;
    plaidItemIdRef: any;
    cursor?: string;
    lastSyncAt?: number;
    lastSyncStatus?: 'success' | 'error';
    lastSyncError?: string;
  }
) {
  const existing = await getByItemForOwner(ctx, args);
  if (existing) {
    await ctx.db.patch(existing._id, {
      cursor: args.cursor ?? existing.cursor,
      lastSyncAt: args.lastSyncAt ?? existing.lastSyncAt,
      lastSyncStatus: args.lastSyncStatus ?? existing.lastSyncStatus,
      lastSyncError: args.lastSyncError ?? existing.lastSyncError,
    });
    return;
  }
  await ctx.db.insert('syncState', {
    ownerType: args.ownerType,
    ownerId: args.ownerId,
    plaidItemIdRef: args.plaidItemIdRef,
    cursor: args.cursor,
    lastSyncAt: args.lastSyncAt,
    lastSyncStatus: args.lastSyncStatus,
    lastSyncError: args.lastSyncError,
  });
}

export const getByItem = query({
  args: {
    ...ownerArgs,
    plaidItemIdRef: v.id('plaidItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await getByItemForOwner(ctx, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemIdRef: args.plaidItemIdRef,
    });
  },
});

export const upsertInternal = mutation({
  args: {
    ...ownerArgs,
    plaidItemIdRef: v.id('plaidItems'),
    cursor: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.union(v.literal('success'), v.literal('error'))),
    lastSyncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await upsertForOwner(ctx, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemIdRef: args.plaidItemIdRef,
      cursor: args.cursor,
      lastSyncAt: args.lastSyncAt,
      lastSyncStatus: args.lastSyncStatus,
      lastSyncError: args.lastSyncError,
    });
  },
});

export const getByItemInternal = internalQuery({
  args: {
    ...ownerArgs,
    plaidItemIdRef: v.id('plaidItems'),
  },
  handler: async (ctx, args) => {
    return await getByItemForOwner(ctx, args);
  },
});

export const upsertForSyncInternal = internalMutation({
  args: {
    ...ownerArgs,
    plaidItemIdRef: v.id('plaidItems'),
    cursor: v.optional(v.string()),
    lastSyncAt: v.optional(v.number()),
    lastSyncStatus: v.optional(v.union(v.literal('success'), v.literal('error'))),
    lastSyncError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await upsertForOwner(ctx, args);
  },
});
