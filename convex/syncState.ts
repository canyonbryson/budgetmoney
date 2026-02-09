import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';

export const getByItem = query({
  args: {
    ...ownerArgs,
    plaidItemIdRef: v.id('plaidItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('syncState')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('plaidItemIdRef'), args.plaidItemIdRef)
        )
      )
      .first();
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
    const existing = await ctx.db
      .query('syncState')
      .filter((q) => q.eq(q.field('plaidItemIdRef'), args.plaidItemIdRef))
      .first();
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
