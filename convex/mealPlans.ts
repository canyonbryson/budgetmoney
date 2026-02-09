import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { api } from './_generated/api';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';
import {
  normalizeItemName,
  normalizeQuantity,
  roundQuantity,
  type UnitKind,
} from './lib/normalize';
import { lookupSpoonacularPrice } from './priceProviders/spoonacular';

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePrice(value: number, unit?: 'cents' | 'dollars') {
  if (unit === 'cents') return value / 100;
  return value;
}

export const getCurrentWeek = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = formatDate(getWeekStart());

    const plan = await ctx.db
      .query('mealPlans')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('weekStart'), weekStart)
        )
      )
      .first();

    if (!plan) {
      return { weekStart, items: [] as any[] };
    }

    const items = await ctx.db
      .query('mealPlanItems')
      .filter((q) => q.eq(q.field('mealPlanId'), plan._id))
      .collect();

    return { weekStart, items };
  },
});

export const getShoppingListCurrentWeek = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = formatDate(getWeekStart());

    const plan = await ctx.db
      .query('mealPlans')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('weekStart'), weekStart)
        )
      )
      .first();

    if (!plan) {
      return { weekStart, items: [], totalEstimatedCost: 0 };
    }

    const items = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_plan', (q) => q.eq('mealPlanId', plan._id))
      .collect();

    const pantryItems = await ctx.db
      .query('pantryItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();

    type PantryAggregate = {
      quantity: number;
      unit?: string;
      kind: UnitKind;
      hasUnknownQuantity: boolean;
    };

    const pantryIndex = new Map<string, Map<string, PantryAggregate>>();
    const pantryKey = (kind: UnitKind, unit?: string) =>
      kind === 'unknown' ? `unknown:${unit ?? ''}` : kind;

    for (const pantryItem of pantryItems) {
      const normalizedName = normalizeItemName(pantryItem.name);
      if (!normalizedName) continue;
      const normalized = normalizeQuantity(pantryItem.quantity, pantryItem.unit);
      const key = pantryKey(normalized.kind, normalized.unit);
      const byKind = pantryIndex.get(normalizedName) ?? new Map<string, PantryAggregate>();
      const current = byKind.get(key) ?? {
        quantity: 0,
        unit: normalized.unit,
        kind: normalized.kind,
        hasUnknownQuantity: false,
      };

      if (normalized.quantity === undefined) {
        current.hasUnknownQuantity = true;
      } else {
        current.quantity = roundQuantity(current.quantity + normalized.quantity);
      }

      byKind.set(key, current);
      pantryIndex.set(normalizedName, byKind);
    }

    const enrichedItems = items.map((item) => {
      const normalizedName = normalizeItemName(item.itemName);
      const normalized = normalizeQuantity(item.quantity, item.unit);
      const byKind = normalizedName ? pantryIndex.get(normalizedName) : undefined;
      let pantryMatch: PantryAggregate | undefined;

      if (byKind) {
        if (normalized.kind !== 'unknown') {
          pantryMatch = byKind.get(normalized.kind);
        }
        if (!pantryMatch) {
          pantryMatch = Array.from(byKind.values())[0];
        }
      }

      let inPantry = false;
      let coverage: 'none' | 'partial' | 'full' | 'unknown' = 'none';
      let remainingQuantity: number | undefined;
      let remainingUnit: string | undefined;
      let pantryQuantity: number | undefined;
      let pantryUnit: string | undefined;

      if (pantryMatch) {
        inPantry = true;
        pantryUnit = pantryMatch.unit;
        pantryQuantity = pantryMatch.hasUnknownQuantity ? undefined : pantryMatch.quantity;

        if (
          pantryMatch.hasUnknownQuantity ||
          normalized.quantity === undefined ||
          pantryMatch.kind !== normalized.kind
        ) {
          coverage = 'unknown';
        } else {
          const remaining = roundQuantity(normalized.quantity - pantryMatch.quantity);
          if (remaining <= 0) {
            coverage = 'full';
          } else {
            coverage = 'partial';
            remainingQuantity = remaining;
            remainingUnit = normalized.unit;
          }
        }
      }

      return {
        ...item,
        inPantry,
        coverage,
        remainingQuantity,
        remainingUnit,
        pantryQuantity,
        pantryUnit,
      };
    });

    const total = items.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0);
    return {
      weekStart,
      items: enrichedItems,
      totalEstimatedCost: roundCurrency(total),
    };
  },
});

export const generateShoppingListInternal = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = formatDate(getWeekStart());
    const now = Date.now();
    let plan = await ctx.db
      .query('mealPlans')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('weekStart'), weekStart)
        )
      )
      .first();

    if (!plan) {
      const id = await ctx.db.insert('mealPlans', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
        createdAt: now,
        updatedAt: now,
      });
      plan = await ctx.db.get(id);
    }

    const existing = await ctx.db
      .query('shoppingListItems')
      .filter((q) => q.eq(q.field('mealPlanId'), plan!._id))
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    const canonicalItems = await ctx.db
      .query('canonicalItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();

    const canonicalIndex = new Map<string, typeof canonicalItems[number]>();
    const indexCanonicalItem = (item: typeof canonicalItems[number]) => {
      const names = [item.name, ...(item.aliases ?? [])];
      for (const name of names) {
        const normalized = normalizeItemName(name);
        if (normalized) canonicalIndex.set(normalized, item);
      }
    };
    for (const item of canonicalItems) indexCanonicalItem(item);

    const getOrCreateCanonicalItemId = async (name: string): Promise<Id<'canonicalItems'>> => {
      const trimmed = name.trim();
      const normalizedName = normalizeItemName(trimmed);
      const existing = normalizedName ? canonicalIndex.get(normalizedName) : undefined;
      if (existing) {
        const aliasNormalized = normalizeItemName(trimmed);
        const aliases = existing.aliases ?? [];
        const aliasExists = aliases.some(
          (current) => normalizeItemName(current) === aliasNormalized
        );
        if (!aliasExists && trimmed && trimmed !== existing.name) {
          const updatedAliases = [...aliases, trimmed];
          await ctx.db.patch(existing._id, {
            aliases: updatedAliases,
            updatedAt: Date.now(),
          });
          existing.aliases = updatedAliases;
          indexCanonicalItem(existing);
        }
        return existing._id;
      }

      const canonicalName = trimmed || normalizedName || 'item';
      const aliases = trimmed && trimmed !== canonicalName ? [trimmed] : undefined;
      const newId = await ctx.db.insert('canonicalItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        name: canonicalName,
        aliases,
        createdAt: now,
        updatedAt: now,
      });
      const created = await ctx.db.get(newId);
      if (created) indexCanonicalItem(created);
      return newId;
    };

    const getLatestItemPrice = async (canonicalItemId: Id<'canonicalItems'>) => {
      const prices = await ctx.db
        .query('itemPrices')
        .withIndex('by_item', (q) => q.eq('canonicalItemId', canonicalItemId))
        .filter((q) =>
          q.and(
            q.eq(q.field('ownerType'), owner.ownerType),
            q.eq(q.field('ownerId'), owner.ownerId),
            q.eq(q.field('isEstimated'), false)
          )
        )
        .collect();
      if (!prices.length) return null;
      return prices.sort((a, b) => b.purchasedAt - a.purchasedAt)[0];
    };

    type AggregatedItem = {
      canonicalItemId: Id<'canonicalItems'>;
      name: string;
      unit?: string;
      kind: UnitKind;
      quantity: number;
      hasUnknownQuantity: boolean;
    };

    const aggregated = new Map<string, AggregatedItem>();
    const addAggregatedItem = async ({
      name,
      unit,
      quantity,
      normalizedItemId,
      ingredientId,
    }: {
      name: string;
      unit?: string;
      quantity?: number | null;
      normalizedItemId?: Id<'canonicalItems'> | null;
      ingredientId?: Id<'recipeIngredients'>;
    }) => {
      const trimmedName = name.trim();
      if (!trimmedName.length) return;

      const canonicalItemId =
        normalizedItemId ?? (await getOrCreateCanonicalItemId(trimmedName));

      if (!normalizedItemId && ingredientId) {
        await ctx.db.patch(ingredientId, { normalizedItemId: canonicalItemId });
      }

      const normalized = normalizeQuantity(quantity, unit);
      const key =
        normalized.kind === 'unknown'
          ? `${canonicalItemId}:${normalized.unit ?? ''}`
          : `${canonicalItemId}:${normalized.kind}`;
      const current = aggregated.get(key) ?? {
        canonicalItemId,
        name: trimmedName,
        unit: normalized.unit,
        kind: normalized.kind,
        quantity: 0,
        hasUnknownQuantity: false,
      };

      if (normalized.quantity === undefined) {
        current.hasUnknownQuantity = true;
      } else {
        current.quantity = roundQuantity(current.quantity + normalized.quantity);
      }

      aggregated.set(key, current);
    };

    const planItems = await ctx.db
      .query('mealPlanItems')
      .filter((q) => q.eq(q.field('mealPlanId'), plan!._id))
      .collect();

    for (const item of planItems) {
      if (item.recipeId) {
        const ingredients = await ctx.db
          .query('recipeIngredients')
          .withIndex('by_recipe', (q) => q.eq('recipeId', item.recipeId!))
          .collect();
        if (ingredients.length) {
          for (const ingredient of ingredients) {
            await addAggregatedItem({
              name: ingredient.name,
              unit: ingredient.unit,
              quantity: ingredient.quantity,
              normalizedItemId: ingredient.normalizedItemId,
              ingredientId: ingredient._id,
            });
          }
        } else {
          await addAggregatedItem({
            name: item.title,
            unit: 'x',
            quantity: 1,
          });
        }
      } else {
        await addAggregatedItem({
          name: item.title,
          unit: 'x',
          quantity: 1,
        });
      }
    }

    for (const item of aggregated.values()) {
      const quantity = item.hasUnknownQuantity ? undefined : item.quantity;
      let estimatedCost: number | undefined;
      let priceSource: 'receipt' | undefined;
      const latestPrice = await getLatestItemPrice(item.canonicalItemId);
      let latestPriceValue = latestPrice?.price;

      if (latestPriceValue !== undefined && latestPriceValue !== null) {
        estimatedCost =
          quantity === undefined
            ? roundCurrency(latestPriceValue)
            : roundCurrency(latestPriceValue * quantity);
        priceSource = 'receipt';
      }

      await ctx.db.insert('shoppingListItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        mealPlanId: plan!._id,
        canonicalItemId: item.canonicalItemId,
        itemName: item.name,
        quantity,
        unit: item.unit,
        estimatedCost,
        priceSource,
        isChecked: false,
      });
    }

    return { planId: plan!._id };
  },
});

export const listShoppingListItemsInternal = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = formatDate(getWeekStart());

    const plan = await ctx.db
      .query('mealPlans')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('weekStart'), weekStart)
        )
      )
      .first();

    if (!plan) return [];

    return await ctx.db
      .query('shoppingListItems')
      .withIndex('by_plan', (q) => q.eq('mealPlanId', plan._id))
      .collect();
  },
});

export const applyShoppingListOnlinePrice = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('shoppingListItems'),
    canonicalItemId: v.optional(v.id('canonicalItems')),
    estimatedCost: v.number(),
    unitPrice: v.number(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== owner.ownerId || item.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }

    await ctx.db.patch(args.itemId, {
      estimatedCost: args.estimatedCost,
      priceSource: 'online',
    });

    const canonicalItemId = args.canonicalItemId ?? item.canonicalItemId;
    if (canonicalItemId) {
      await ctx.db.insert('itemPrices', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        canonicalItemId,
        price: args.unitPrice,
        currency: args.currency ?? 'USD',
        source: 'online',
        isEstimated: true,
        purchasedAt: Date.now(),
      });
    }
  },
});

export const generateShoppingList = action({
  args: ownerArgs,
  handler: async (
    ctx,
    args
  ): Promise<{ status: 'ok'; planId: Id<'mealPlans'>; onlineLookups: number }> => {
    const owner = await resolveOwner(ctx, args);
    const { planId }: { planId: Id<'mealPlans'> } = await ctx.runMutation(
      api.mealPlans.generateShoppingListInternal,
      args
    );

    let canLookup = true;
    try {
      await requireSignedIn(ctx);
    } catch {
      canLookup = false;
    }

    const base =
      process.env.SPOONACULAR_BASE_URL ??
      process.env.PRICE_LOOKUP_BASE_URL ??
      'https://api.spoonacular.com';
    const key = process.env.SPOONACULAR_API_KEY ?? process.env.PRICE_LOOKUP_API_KEY;
    const priceUnitRaw =
      process.env.SPOONACULAR_PRICE_UNIT ?? process.env.PRICE_LOOKUP_PRICE_UNIT;
    const priceUnit =
      priceUnitRaw === 'cents' || priceUnitRaw === 'dollars' ? priceUnitRaw : undefined;

    if (!canLookup || !key) {
      return { status: 'ok', planId, onlineLookups: 0 };
    }

    const items: Doc<'shoppingListItems'>[] = await ctx.runQuery(
      api.mealPlans.listShoppingListItemsInternal,
      args
    );
    const missing = items.filter((item) => !item.estimatedCost);
    const maxLookups = 12;
    let onlineLookups = 0;

    for (const item of missing.slice(0, maxLookups)) {
      try {
        const result = await lookupSpoonacularPrice(item.itemName, {
          apiKey: key,
          baseUrl: base,
          priceUnit,
        });
        if (result.price === undefined || result.price === null) continue;
        const unitPrice = normalizePrice(result.price, result.priceUnit);
        if (unitPrice === undefined) continue;
        const estimatedCost =
          item.quantity === undefined
            ? roundCurrency(unitPrice)
            : roundCurrency(unitPrice * item.quantity);

        await ctx.runMutation(api.mealPlans.applyShoppingListOnlinePrice, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId: item._id,
          canonicalItemId: item.canonicalItemId ?? undefined,
          estimatedCost,
          unitPrice,
          currency: result.currency ?? 'USD',
        });
        onlineLookups += 1;
      } catch {
        // Ignore lookup failures and continue.
      }
    }

    return { status: 'ok', planId, onlineLookups };
  },
});

export const addMealPlanItem = mutation({
  args: {
    ...ownerArgs,
    title: v.string(),
    day: v.string(),
    slot: v.optional(v.string()),
    recipeId: v.optional(v.id('recipes')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = formatDate(getWeekStart());
    const now = Date.now();

    let plan = await ctx.db
      .query('mealPlans')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('weekStart'), weekStart)
        )
      )
      .first();

    if (!plan) {
      const id = await ctx.db.insert('mealPlans', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
        createdAt: now,
        updatedAt: now,
      });
      plan = await ctx.db.get(id);
    }

    if (!plan) throw new Error('Meal plan not found');

    await ctx.db.insert('mealPlanItems', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      mealPlanId: plan._id,
      title: args.title,
      day: args.day,
      slot: args.slot,
      recipeId: args.recipeId,
      notes: args.notes,
    });

    await ctx.db.patch(plan._id, { updatedAt: now });
  },
});

export const updateMealPlanItem = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('mealPlanItems'),
    title: v.string(),
    day: v.string(),
    slot: v.optional(v.string()),
    recipeId: v.optional(v.id('recipes')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error('Meal plan item not found');
    if (item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }
    await ctx.db.patch(args.itemId, {
      title: args.title,
      day: args.day,
      slot: args.slot,
      recipeId: args.recipeId,
      notes: args.notes,
    });
  },
});

export const deleteMealPlanItem = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('mealPlanItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error('Meal plan item not found');
    if (item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }
    await ctx.db.delete(args.itemId);
  },
});

export const setShoppingListItemChecked = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('shoppingListItems'),
    isChecked: v.boolean(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error('Shopping list item not found');
    }
    if (item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }
    await ctx.db.patch(args.itemId, { isChecked: args.isChecked });
  },
});

export const moveShoppingListItemToPantry = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('shoppingListItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item) {
      throw new Error('Shopping list item not found');
    }
    if (item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }

    const normalizedName = normalizeItemName(item.itemName);
    const normalized = normalizeQuantity(item.quantity ?? null, item.unit ?? null);

    const pantryItems = await ctx.db
      .query('pantryItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();

    const candidates = pantryItems.filter(
      (pantryItem) => normalizeItemName(pantryItem.name) === normalizedName
    );

    let target = candidates[0];
    if (normalized.kind !== 'unknown') {
      target =
        candidates.find((pantryItem) => {
          const pantryNormalized = normalizeQuantity(
            pantryItem.quantity ?? null,
            pantryItem.unit ?? null
          );
          return pantryNormalized.kind === normalized.kind;
        }) ?? target;
    }

    const now = Date.now();

    if (target) {
      const pantryNormalized = normalizeQuantity(
        target.quantity ?? null,
        target.unit ?? null
      );
      if (
        normalized.quantity !== undefined &&
        pantryNormalized.quantity !== undefined &&
        normalized.kind === pantryNormalized.kind &&
        normalized.kind !== 'unknown'
      ) {
        await ctx.db.patch(target._id, {
          quantity: roundQuantity(pantryNormalized.quantity + normalized.quantity),
          unit: normalized.unit ?? target.unit,
          updatedAt: now,
        });
      } else if (target.quantity === undefined && normalized.quantity !== undefined) {
        await ctx.db.patch(target._id, {
          quantity: normalized.quantity,
          unit: normalized.unit ?? target.unit,
          updatedAt: now,
        });
      }
    } else if (normalizedName) {
      await ctx.db.insert('pantryItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        name: item.itemName,
        quantity: normalized.quantity,
        unit: normalized.unit,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.itemId, { isChecked: true });
    return { status: 'moved' };
  },
});
