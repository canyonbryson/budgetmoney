import { v } from 'convex/values';
import { QueryCtx, MutationCtx, ActionCtx } from './_generated/server';

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

export async function resolveOwner(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  args: { ownerType: 'device' | 'user' | 'family'; ownerId: string }
): Promise<Owner> {
  const auth = await ctx.auth.getUserIdentity();
  if (auth) {
    if (!isFamilyModeEnabled()) {
      return { ownerType: 'user', ownerId: auth.subject };
    }
    const canReadDb = 'db' in ctx;
    if (!canReadDb) {
      if (args.ownerType === 'family' && args.ownerId) {
        return { ownerType: 'family', ownerId: args.ownerId };
      }
      throw new Error('Missing family context.');
    }
    const membership = await ctx.db
      .query('familyMembers')
      .withIndex('by_userId_status', (q: any) =>
        q.eq('userId', auth.subject).eq('status', 'active')
      )
      .first();
    if (!membership) {
      throw new Error('Family setup is incomplete. Please create or join a family.');
    }
    return { ownerType: 'family', ownerId: String(membership.familyId) };
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

