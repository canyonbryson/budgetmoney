import { v } from 'convex/values';
import { QueryCtx, MutationCtx, ActionCtx } from './_generated/server';

export const ownerArgs = {
  ownerType: v.union(v.literal('device'), v.literal('user')),
  ownerId: v.string(),
};

export type Owner = {
  ownerType: 'device' | 'user';
  ownerId: string;
};

export async function resolveOwner(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  args: { ownerType: 'device' | 'user'; ownerId: string }
): Promise<Owner> {
  const auth = await ctx.auth.getUserIdentity();
  if (auth) {
    return { ownerType: 'user', ownerId: auth.subject };
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

