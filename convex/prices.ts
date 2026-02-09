import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';
import { lookupSpoonacularPrice } from './priceProviders/spoonacular';

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
      source: 'online',
      isEstimated: true,
      purchasedAt: Date.now(),
    });
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

    const base =
      process.env.SPOONACULAR_BASE_URL ??
      process.env.PRICE_LOOKUP_BASE_URL ??
      'https://api.spoonacular.com';
    const key = process.env.SPOONACULAR_API_KEY ?? process.env.PRICE_LOOKUP_API_KEY;
    const priceUnitRaw =
      process.env.SPOONACULAR_PRICE_UNIT ?? process.env.PRICE_LOOKUP_PRICE_UNIT;
    const priceUnit =
      priceUnitRaw === 'cents' || priceUnitRaw === 'dollars' ? priceUnitRaw : undefined;
    if (!key) {
      throw new Error('Missing price lookup API key');
    }

    return lookupSpoonacularPrice(args.query, { apiKey: key, baseUrl: base, priceUnit });
  },
});
