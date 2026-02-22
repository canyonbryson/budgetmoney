import { v } from 'convex/values';
import { QueryCtx, MutationCtx, ActionCtx, internalQuery } from './_generated/server';
import { internal } from './_generated/api';

export const ownerArgs = {
  ownerType: v.union(v.literal('device'), v.literal('user'), v.literal('family')),
  ownerId: v.string(),
};

export type Owner = {
  ownerType: 'device' | 'user' | 'family';
  ownerId: string;
};

export function isFamilyModeEnabled() {
  return process.env.FAMILY_MODE_ENABLED !== 'false';
}

async function resolveSignedInOwnerFromDb(
  ctx: QueryCtx | MutationCtx | { db: QueryCtx['db'] },
  userId: string
): Promise<Owner> {
  if (!isFamilyModeEnabled()) {
    return { ownerType: 'user', ownerId: userId };
  }
  const membership = await ctx.db
    .query('familyMembers')
    .withIndex('by_userId_status', (q: any) => q.eq('userId', userId).eq('status', 'active'))
    .first();
  if (!membership) {
    throw new Error('Family setup is incomplete. Please create or join a family.');
  }
  return { ownerType: 'family', ownerId: String(membership.familyId) };
}

export async function resolveOwner(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  args: { ownerType: 'device' | 'user' | 'family'; ownerId: string }
): Promise<Owner> {
  const auth = await ctx.auth.getUserIdentity();
  if (auth) {
    const canReadDb = 'db' in ctx;
    if (canReadDb) {
      return await resolveSignedInOwnerFromDb(ctx, auth.subject);
    }
    return await ctx.runQuery(internal.ownership.resolveSignedInOwnerInternal, {
      userId: auth.subject,
    });
  }
  if (args.ownerType !== 'device') {
    throw new Error('Not authorized');
  }
  if (!args.ownerId) {
    throw new Error('Missing deviceId');
  }
  return { ownerType: 'device', ownerId: args.ownerId };
}

export async function requireSignedIn(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const auth = await ctx.auth.getUserIdentity();
  if (!auth) throw new Error('Signed in required');
  return auth;
}

export const resolveSignedInOwnerInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await resolveSignedInOwnerFromDb(ctx, args.userId);
  },
});
