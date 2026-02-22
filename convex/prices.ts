import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';
import { lookupWalmartPrice } from './priceProviders/walmart';

function normalizeEstimateSource(source?: 'walmart' | 'ai' | 'online' | 'winco') {
  if (source === 'ai') return 'ai';
  return 'walmart';
}

export const getForItem = query({
  args: {
    ...ownerArgs,
    canonicalItemId: v.id('canonicalItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const prices = await ctx.db
      .query('itemPrices')
      .filter((q) =>
        q.and(
          q.eq(q.field('canonicalItemId'), args.canonicalItemId),
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    const sorted = prices.sort((a, b) => b.purchasedAt - a.purchasedAt);
    return sorted[0] ?? null;
  },
});

export const getLatestPurchasePrice = query({
  args: {
    ...ownerArgs,
    canonicalItemId: v.id('canonicalItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const prices = await ctx.db
      .query('itemPrices')
      .filter((q) =>
        q.and(
          q.eq(q.field('canonicalItemId'), args.canonicalItemId),
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('isEstimated'), false)
        )
      )
      .collect();
    const sorted = prices.sort((a, b) => b.purchasedAt - a.purchasedAt);
    return sorted[0] ?? null;
  },
});

export const recordPriceEstimate = mutation({
  args: {
    ...ownerArgs,
    canonicalItemId: v.id('canonicalItems'),
    price: v.number(),
    currency: v.optional(v.string()),
    source: v.optional(
      v.union(v.literal('walmart'), v.literal('ai'), v.literal('online'), v.literal('winco'))
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await ctx.db.insert('itemPrices', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      canonicalItemId: args.canonicalItemId,
      price: args.price,
      currency: args.currency ?? 'USD',
      source: normalizeEstimateSource(args.source),
      isEstimated: true,
      purchasedAt: Date.now(),
    });
  },
});

export const recordOnlineEstimate = mutation({
  args: {
    ...ownerArgs,
    canonicalItemId: v.id('canonicalItems'),
    price: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await ctx.db.insert('itemPrices', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      canonicalItemId: args.canonicalItemId,
      price: args.price,
      currency: args.currency ?? 'USD',
      source: 'walmart',
      isEstimated: true,
      purchasedAt: Date.now(),
    });
  },
});

function resolveWalmartLookupConfig() {
  const baseUrl = process.env.WALMART_API_BASE_URL ?? process.env.PRICE_LOOKUP_BASE_URL;
  if (!baseUrl) {
    throw new Error('Missing WALMART_API_BASE_URL');
  }

  const priceUnitRaw = process.env.WALMART_PRICE_UNIT ?? process.env.PRICE_LOOKUP_PRICE_UNIT;
  const priceUnit =
    priceUnitRaw === 'cents' || priceUnitRaw === 'dollars' ? priceUnitRaw : undefined;

  return {
    baseUrl,
    apiKey: process.env.WALMART_API_KEY,
    apiKeyHeader: process.env.WALMART_API_KEY_HEADER,
    hostHeader: process.env.WALMART_API_HOST_HEADER,
    hostValue: process.env.WALMART_API_HOST_VALUE,
    queryParam: process.env.WALMART_QUERY_PARAM,
    priceUnit,
  } as const;
}

export const lookupWalmart = action({
  args: {
    ...ownerArgs,
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    await resolveOwner(ctx, args);
    const config = resolveWalmartLookupConfig();
    return lookupWalmartPrice(args.query, config);
  },
});

export const lookupOnline = action({
  args: {
    ...ownerArgs,
    query: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    await resolveOwner(ctx, args);
    const config = resolveWalmartLookupConfig();
    return lookupWalmartPrice(args.query, config);
  },
});
