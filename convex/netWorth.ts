import { v } from 'convex/values';
import { mutation, query, internalMutation } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';
import { inferNetWorthRole, resolveIncludeInNetWorth, type NetWorthRole } from './netWorthUtils';

type AccountLike = {
  currentBalance?: number;
  availableBalance?: number;
  netWorthRole?: NetWorthRole;
  type?: string;
  subtype?: string;
  includeInNetWorth?: boolean;
  netWorthBucketId?: string;
};

function getAccountBalance(account: AccountLike) {
  if (typeof account.currentBalance === 'number') return account.currentBalance;
  if (typeof account.availableBalance === 'number') return account.availableBalance;
  return 0;
}

function aggregateCurrentTotals(accounts: AccountLike[]) {
  let checkingTotal = 0;
  let savingsTotal = 0;
  let investmentTotal = 0;
  let liabilitiesTotal = 0;

  for (const account of accounts) {
    if (!resolveIncludeInNetWorth(account)) continue;
    const role = account.netWorthRole ?? inferNetWorthRole(account.type, account.subtype);
    const balance = getAccountBalance(account);
    if (!Number.isFinite(balance)) continue;

    if (role === 'liability') {
      liabilitiesTotal += Math.abs(balance);
      continue;
    }
    if (role === 'savings') savingsTotal += balance;
    else if (role === 'investment') investmentTotal += balance;
    else checkingTotal += balance;
  }

  const assetsTotal = checkingTotal + savingsTotal + investmentTotal;
  const netWorthTotal = assetsTotal - liabilitiesTotal;
  return {
    assetsTotal,
    liabilitiesTotal,
    netWorthTotal,
    checkingTotal,
    savingsTotal,
    investmentTotal,
  };
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function projectPrincipal(principal: number, aprPercent: number, months: number) {
  const monthlyRate = aprPercent / 100 / 12;
  return principal * Math.pow(1 + monthlyRate, months);
}

export const listBuckets = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return await ctx.db
      .query('netWorthBuckets')
      .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .collect();
  },
});

export const createBucket = mutation({
  args: {
    ...ownerArgs,
    name: v.string(),
    role: v.union(v.literal('savings'), v.literal('investment')),
    interestRateApr: v.number(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    return await ctx.db.insert('netWorthBuckets', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      name: args.name.trim(),
      role: args.role,
      interestRateApr: args.interestRateApr,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateBucket = mutation({
  args: {
    ...ownerArgs,
    bucketId: v.id('netWorthBuckets'),
    name: v.optional(v.string()),
    interestRateApr: v.optional(v.number()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket || bucket.ownerType !== owner.ownerType || bucket.ownerId !== owner.ownerId) {
      throw new Error('Bucket not found');
    }
    await ctx.db.patch(args.bucketId, {
      name: args.name?.trim() ?? bucket.name,
      interestRateApr: args.interestRateApr ?? bucket.interestRateApr,
      color: args.color ?? bucket.color,
      updatedAt: Date.now(),
    });
  },
});

export const deleteBucket = mutation({
  args: {
    ...ownerArgs,
    bucketId: v.id('netWorthBuckets'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const bucket = await ctx.db.get(args.bucketId);
    if (!bucket || bucket.ownerType !== owner.ownerType || bucket.ownerId !== owner.ownerId) {
      return;
    }

    const accounts = await ctx.db
      .query('plaidAccounts')
      .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .collect();
    for (const account of accounts) {
      if (account.netWorthBucketId === args.bucketId) {
        await ctx.db.patch(account._id, { netWorthBucketId: undefined, updatedAt: Date.now() });
      }
    }

    await ctx.db.delete(args.bucketId);
  },
});

export const getSummary = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const accounts = await ctx.db
      .query('plaidAccounts')
      .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .collect();

    return aggregateCurrentTotals(accounts);
  },
});

export const getTimeline = query({
  args: {
    ...ownerArgs,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const limit = Math.max(1, Math.min(args.limit ?? 90, 365));
    const snapshots = await ctx.db
      .query('netWorthSnapshots')
      .withIndex('by_owner_date', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .order('desc')
      .take(limit);
    const points = [...snapshots]
      .reverse()
      .map((snapshot) => ({
        asOfDate: snapshot.asOfDate,
        assetsTotal: snapshot.assetsTotal,
        liabilitiesTotal: snapshot.liabilitiesTotal,
        netWorthTotal: snapshot.netWorthTotal,
      }));

    const today = getDateKey();
    if (!points.length || points[points.length - 1].asOfDate !== today) {
      const accounts = await ctx.db
        .query('plaidAccounts')
        .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
        .collect();
      const live = aggregateCurrentTotals(accounts);
      points.push({
        asOfDate: today,
        assetsTotal: live.assetsTotal,
        liabilitiesTotal: live.liabilitiesTotal,
        netWorthTotal: live.netWorthTotal,
      });
    }

    return { points };
  },
});

export const getProjection = query({
  args: {
    ...ownerArgs,
    months: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const horizon = Math.max(1, Math.min(args.months ?? 12, 60));
    const accounts = await ctx.db
      .query('plaidAccounts')
      .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .collect();
    const buckets = await ctx.db
      .query('netWorthBuckets')
      .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .collect();
    const bucketById = new Map(buckets.map((bucket) => [String(bucket._id), bucket]));

    const current = aggregateCurrentTotals(accounts);
    const baseLiabilities = current.liabilitiesTotal;
    const baseChecking = current.checkingTotal;
    let unbucketedSavings = 0;
    let unbucketedInvestments = 0;
    const principalByBucket = new Map<string, number>();

    for (const account of accounts) {
      if (!resolveIncludeInNetWorth(account)) continue;
      const role = account.netWorthRole ?? inferNetWorthRole(account.type, account.subtype);
      if (role === 'liability' || role === 'checking') continue;
      const balance = getAccountBalance(account);
      if (!Number.isFinite(balance)) continue;
      const bucketKey = account.netWorthBucketId ? String(account.netWorthBucketId) : '';
      if (bucketKey && bucketById.has(bucketKey)) {
        principalByBucket.set(bucketKey, (principalByBucket.get(bucketKey) ?? 0) + balance);
      } else if (role === 'savings') {
        unbucketedSavings += balance;
      } else {
        unbucketedInvestments += balance;
      }
    }

    const now = new Date();
    const points: Array<{
      monthIndex: number;
      asOfDate: string;
      assetsTotal: number;
      liabilitiesTotal: number;
      netWorthTotal: number;
      checkingTotal: number;
      savingsTotal: number;
      investmentTotal: number;
    }> = [];

    for (let i = 0; i <= horizon; i += 1) {
      let projectedSavings = unbucketedSavings;
      let projectedInvestments = unbucketedInvestments;

      for (const [bucketId, principal] of principalByBucket.entries()) {
        const bucket = bucketById.get(bucketId);
        if (!bucket) continue;
        const projected = projectPrincipal(principal, bucket.interestRateApr, i);
        if (bucket.role === 'savings') projectedSavings += projected;
        else projectedInvestments += projected;
      }

      const assetsTotal = baseChecking + projectedSavings + projectedInvestments;
      const liabilitiesTotal = baseLiabilities;
      const netWorthTotal = assetsTotal - liabilitiesTotal;
      const date = new Date(now);
      date.setMonth(now.getMonth() + i);
      points.push({
        monthIndex: i,
        asOfDate: getDateKey(date),
        assetsTotal,
        liabilitiesTotal,
        netWorthTotal,
        checkingTotal: baseChecking,
        savingsTotal: projectedSavings,
        investmentTotal: projectedInvestments,
      });
    }

    return { points };
  },
});

export const captureSnapshotInternal = internalMutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const accounts = await ctx.db
      .query('plaidAccounts')
      .withIndex('by_owner', (q) => q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId))
      .collect();
    const totals = aggregateCurrentTotals(accounts);
    const asOfDate = getDateKey();

    const existing = await ctx.db
      .query('netWorthSnapshots')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('asOfDate', asOfDate)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        assetsTotal: totals.assetsTotal,
        liabilitiesTotal: totals.liabilitiesTotal,
        netWorthTotal: totals.netWorthTotal,
        checkingTotal: totals.checkingTotal,
        savingsTotal: totals.savingsTotal,
        investmentTotal: totals.investmentTotal,
        createdAt: Date.now(),
      });
      return;
    }

    await ctx.db.insert('netWorthSnapshots', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      asOfDate,
      assetsTotal: totals.assetsTotal,
      liabilitiesTotal: totals.liabilitiesTotal,
      netWorthTotal: totals.netWorthTotal,
      checkingTotal: totals.checkingTotal,
      savingsTotal: totals.savingsTotal,
      investmentTotal: totals.investmentTotal,
      createdAt: Date.now(),
    });
  },
});
