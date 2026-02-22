import { v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { requireSignedIn, isFamilyModeEnabled } from './ownership';
import { migrateOwnerData } from './familyMigration';

export function normalizeEmail(email?: string) {
  const value = email?.trim().toLowerCase();
  return value && value.length > 0 ? value : undefined;
}

async function hashToken(raw: string) {
  const bytes = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashBytes = new Uint8Array(hashBuffer);
  let binary = '';
  for (const byte of hashBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function buildInviteUrl(token: string) {
  const appUrl = (process.env.EXPO_PUBLIC_APP_URL ?? 'budgetmoney://').trim();
  const invitePath = `/family-accept/${encodeURIComponent(token)}`;
  const fallbackUrl = new URL('budgetmoney://');
  fallbackUrl.pathname = invitePath;

  try {
    const url = new URL(appUrl);
    url.pathname = invitePath;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return fallbackUrl.toString();
  }
}

async function getActiveMembership(ctx: any, userId: string) {
  return await ctx.db
    .query('familyMembers')
    .withIndex('by_userId_status', (q: any) => q.eq('userId', userId).eq('status', 'active'))
    .first();
}

async function getOwnedFamilyMembership(ctx: any, userId: string) {
  const membership = await getActiveMembership(ctx, userId);
  if (!membership) throw new Error('No active family.');
  if (membership.role !== 'owner') throw new Error('Only family owners can invite members.');
  return membership;
}

export const getMyFamily = query({
  args: {},
  handler: async (ctx) => {
    if (!isFamilyModeEnabled()) {
      return null;
    }
    const auth = await requireSignedIn(ctx);
    const membership = await getActiveMembership(ctx, auth.subject);
    if (!membership) {
      return null;
    }
    const family: any = await ctx.db.get(membership.familyId);
    if (!family) {
      return null;
    }
    const pendingInvites = await ctx.db
      .query('familyInvites')
      .withIndex('by_family_status', (q: any) =>
        q.eq('familyId', membership.familyId).eq('status', 'pending')
      )
      .collect();
    return {
      familyId: String(family._id),
      familyName: family.name,
      role: membership.role,
      pendingInviteCount: pendingInvites.filter((invite: any) => invite.expiresAt > Date.now()).length,
    };
  },
});

export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    if (!isFamilyModeEnabled()) return [];
    const auth = await requireSignedIn(ctx);
    const membership = await getActiveMembership(ctx, auth.subject);
    if (!membership) return [];

    const members = await ctx.db
      .query('familyMembers')
      .withIndex('by_family_status', (q: any) =>
        q.eq('familyId', membership.familyId).eq('status', 'active')
      )
      .collect();

    const usersById = new Map<string, any>();
    for (const member of members) {
      const user = await ctx.db
        .query('users')
        .withIndex('by_userId', (q: any) => q.eq('userId', member.userId))
        .first();
      usersById.set(member.userId, user);
    }

    return members.map((member: any) => ({
      id: String(member._id),
      userId: member.userId,
      role: member.role,
      email: usersById.get(member.userId)?.email,
      joinedAt: member.joinedAt ?? member.createdAt,
    }));
  },
});

export const createFamily = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!isFamilyModeEnabled()) {
      throw new Error('Family mode is disabled.');
    }
    const auth = await requireSignedIn(ctx);
    const existing = await getActiveMembership(ctx, auth.subject);
    if (existing) {
      return { familyId: String(existing.familyId) };
    }
    const now = Date.now();
    const familyId = await ctx.db.insert('families', {
      name: args.name?.trim() || 'My Family',
      createdByUserId: auth.subject,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('familyMembers', {
      familyId,
      userId: auth.subject,
      role: 'owner',
      status: 'active',
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await migrateOwnerData(
      ctx,
      { ownerType: 'user', ownerId: auth.subject },
      { ownerType: 'family', ownerId: String(familyId) }
    );

    return { familyId: String(familyId) };
  },
});

export const createInvite = mutation({
  args: {
    invitedEmail: v.optional(v.string()),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isFamilyModeEnabled()) {
      throw new Error('Family mode is disabled.');
    }
    const auth = await requireSignedIn(ctx);
    const membership = await getOwnedFamilyMembership(ctx, auth.subject);
    const now = Date.now();
    const expiresInDays = Math.min(Math.max(Math.floor(args.expiresInDays ?? 7), 1), 30);
    const token = `${crypto.randomUUID()}-${now}`;
    const tokenHash = await hashToken(token);
    const invitedEmail = normalizeEmail(args.invitedEmail);

    if (invitedEmail) {
      const existingPending = await ctx.db
        .query('familyInvites')
        .withIndex('by_invitedEmail_status', (q: any) =>
          q.eq('invitedEmail', invitedEmail).eq('status', 'pending')
        )
        .collect();
      const duplicate = existingPending.find(
        (invite: any) => invite.familyId === membership.familyId && invite.expiresAt > now
      );
      if (duplicate) {
        throw new Error('A pending invite already exists for this email.');
      }
    }

    const inviteId = await ctx.db.insert('familyInvites', {
      familyId: membership.familyId,
      tokenHash,
      invitedEmail,
      invitedByUserId: auth.subject,
      status: 'pending',
      expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now,
    });

    const inviteUrl = buildInviteUrl(token);
    return { inviteId: String(inviteId), inviteUrl, expiresInDays };
  },
});

export const revokeInvite = mutation({
  args: {
    inviteId: v.id('familyInvites'),
  },
  handler: async (ctx, args) => {
    if (!isFamilyModeEnabled()) {
      throw new Error('Family mode is disabled.');
    }
    const auth = await requireSignedIn(ctx);
    const membership = await getOwnedFamilyMembership(ctx, auth.subject);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.familyId !== membership.familyId) {
      throw new Error('Invite not found.');
    }
    if (invite.status !== 'pending') {
      return;
    }
    await ctx.db.patch(invite._id, {
      status: 'revoked',
      updatedAt: Date.now(),
    });
  },
});

export const acceptInviteByToken = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    if (!isFamilyModeEnabled()) {
      throw new Error('Family mode is disabled.');
    }
    const auth = await requireSignedIn(ctx);
    const now = Date.now();
    const tokenHash = await hashToken(args.token.trim());
    const invite = await ctx.db
      .query('familyInvites')
      .withIndex('by_tokenHash', (q: any) => q.eq('tokenHash', tokenHash))
      .first();
    if (!invite) {
      throw new Error('Invite not found.');
    }
    const existing = await getActiveMembership(ctx, auth.subject);
    const inviteFamilyId = String(invite.familyId);
    const existingFamilyId = existing ? String(existing.familyId) : null;
    let transfer: 'none' | 'fromSoloFamily' = 'none';

    if (existing && existingFamilyId === inviteFamilyId) {
      if (invite.status === 'pending') {
        await ctx.db.patch(invite._id, {
          status: 'accepted',
          acceptedByUserId: auth.subject,
          acceptedAt: now,
          updatedAt: now,
        });
      }
      return { familyId: inviteFamilyId, transfer };
    }

    if (invite.status !== 'pending') {
      throw new Error('Invite is no longer active.');
    }
    if (invite.expiresAt < now) {
      await ctx.db.patch(invite._id, {
        status: 'expired',
        updatedAt: now,
      });
      throw new Error('Invite has expired.');
    }

    if (existing && existingFamilyId !== inviteFamilyId) {
      const currentFamilyMembers = await ctx.db
        .query('familyMembers')
        .withIndex('by_family_status', (q: any) =>
          q.eq('familyId', existing.familyId).eq('status', 'active')
        )
        .collect();
      const hasOtherActiveMembers = currentFamilyMembers.some(
        (member: any) => member.userId !== auth.subject
      );
      if (hasOtherActiveMembers) {
        throw new Error(
          'Cannot transfer because your current family has other active members. Leave that family first.'
        );
      }

      await migrateOwnerData(
        ctx,
        { ownerType: 'family', ownerId: String(existing.familyId) },
        { ownerType: 'family', ownerId: inviteFamilyId }
      );
      await ctx.db.patch(existing._id, {
        status: 'removed',
        updatedAt: now,
      });
      transfer = 'fromSoloFamily';
    }

    await migrateOwnerData(
      ctx,
      { ownerType: 'user', ownerId: auth.subject },
      { ownerType: 'family', ownerId: inviteFamilyId }
    );

    const existingTargetMembership = await ctx.db
      .query('familyMembers')
      .withIndex('by_family_user', (q: any) =>
        q.eq('familyId', invite.familyId).eq('userId', auth.subject)
      )
      .first();
    if (existingTargetMembership) {
      await ctx.db.patch(existingTargetMembership._id, {
        role: existingTargetMembership.role ?? 'member',
        status: 'active',
        invitedByUserId: invite.invitedByUserId ?? existingTargetMembership.invitedByUserId,
        joinedAt: existingTargetMembership.joinedAt ?? now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('familyMembers', {
        familyId: invite.familyId,
        userId: auth.subject,
        role: 'member',
        status: 'active',
        invitedByUserId: invite.invitedByUserId,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(invite._id, {
      status: 'accepted',
      acceptedByUserId: auth.subject,
      acceptedAt: now,
      updatedAt: now,
    });
    return { familyId: inviteFamilyId, transfer };
  },
});

export const backfillUsersWithoutFamily = internalMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!isFamilyModeEnabled()) {
      return { processed: 0, createdFamilies: 0, migratedUsers: 0 };
    }
    const users = await ctx.db.query('users').collect();
    const targetUsers = users.slice(0, Math.max(1, Math.min(args.limit ?? 200, 1000)));
    let createdFamilies = 0;
    let migratedUsers = 0;
    const now = Date.now();

    for (const user of targetUsers) {
      const membership = await getActiveMembership(ctx, user.userId);
      if (membership) {
        continue;
      }
      const familyId = await ctx.db.insert('families', {
        name: 'My Family',
        createdByUserId: user.userId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert('familyMembers', {
        familyId,
        userId: user.userId,
        role: 'owner',
        status: 'active',
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      await migrateOwnerData(
        ctx,
        { ownerType: 'user', ownerId: user.userId },
        { ownerType: 'family', ownerId: String(familyId) }
      );
      createdFamilies += 1;
      migratedUsers += 1;
    }

    return {
      processed: targetUsers.length,
      createdFamilies,
      migratedUsers,
    };
  },
});
