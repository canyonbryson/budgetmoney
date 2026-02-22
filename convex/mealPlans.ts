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
import {
  mergeShoppingListWithAi,
  type ShoppingListMergeItemDraft,
} from './ai/shoppingList';
import {
  finalizePricingFromEvidence,
  estimatePricingWithAi,
  type PricingEvidenceInput,
  type PriceSource,
} from './ai/pricing';
import { lookupWalmartPrice } from './priceProviders/walmart';

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

function getCandidateWeekStarts(date = new Date()) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);
  const candidates: string[] = [];
  for (let daysBack = 0; daysBack < 7; daysBack += 1) {
    const d = new Date(base);
    d.setDate(base.getDate() - daysBack);
    candidates.push(formatDate(d));
  }
  return candidates;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function isFeatureEnabled(value: string | undefined, enabledWhenMissing = true) {
  if (!value) return enabledWhenMissing;
  const normalized = value.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

function normalizePrice(value: number, unit?: 'cents' | 'dollars') {
  if (unit === 'cents') return value / 100;
  return value;
}

function estimateCostFromUnitPrice(
  unitPrice: number,
  quantity?: number | null,
  unit?: string | null
) {
  const normalized = normalizeQuantity(quantity, unit);
  if (normalized.quantity === undefined) return roundCurrency(unitPrice);
  if (normalized.kind === 'count') {
    return roundCurrency(unitPrice * Math.max(1, normalized.quantity));
  }
  const rawQuantity = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 1;
  return roundCurrency(unitPrice * Math.max(1, rawQuantity));
}

function normalizePriceSource(
  source: PriceSource
): 'receipt' | 'walmart' | 'ai' {
  if (source === 'receipt' || source === 'walmart' || source === 'ai') {
    return source;
  }
  if (source === 'online' || source === 'winco') {
    return 'walmart';
  }
  return 'ai';
}

export function resolveShoppingWeekStart(weekStart?: string) {
  return weekStart ?? formatDate(getWeekStart());
}

async function resolveCurrentPlanWeekStart(
  ctx: any,
  owner: { ownerType: 'user' | 'device' | 'family'; ownerId: string }
) {
  const candidates = getCandidateWeekStarts();
  for (const candidate of candidates) {
    const plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q: any) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', candidate)
      )
      .first();
    if (plan) return candidate;
  }
  return resolveShoppingWeekStart();
}

async function listShoppingListItemsForWeekData(
  ctx: any,
  owner: { ownerType: 'user' | 'device' | 'family'; ownerId: string },
  weekStart: string
) {
  const plan = await ctx.db
    .query('mealPlans')
    .withIndex('by_owner_week', (q: any) =>
      q
        .eq('ownerType', owner.ownerType)
        .eq('ownerId', owner.ownerId)
        .eq('weekStart', weekStart)
    )
    .first();

  if (!plan) return [] as Doc<'shoppingListItems'>[];

  return (await ctx.db
    .query('shoppingListItems')
    .withIndex('by_plan', (q: any) => q.eq('mealPlanId', plan._id))
    .collect()) as Doc<'shoppingListItems'>[];
}

async function getShoppingListForWeekData(
  ctx: any,
  owner: { ownerType: 'user' | 'device' | 'family'; ownerId: string },
  weekStart: string
) {
  const items = await listShoppingListItemsForWeekData(ctx, owner, weekStart);

  const pantryItems = await ctx.db
    .query('pantryItems')
    .filter((q: any) =>
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
}

export const getCurrentWeek = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStartCandidates = getCandidateWeekStarts();
    let plan: Doc<'mealPlans'> | null = null;
    let weekStart = weekStartCandidates[0];

    for (const candidate of weekStartCandidates) {
      const candidatePlan = await ctx.db
        .query('mealPlans')
        .withIndex('by_owner_week', (q) =>
          q
            .eq('ownerType', owner.ownerType)
            .eq('ownerId', owner.ownerId)
            .eq('weekStart', candidate)
        )
        .first();
      if (candidatePlan) {
        plan = candidatePlan;
        weekStart = candidate;
        break;
      }
    }

    if (!plan) {
      return { weekStart, planningMode: undefined, items: [] as any[] };
    }

    const items = await ctx.db
      .query('mealPlanItems')
      .withIndex('by_plan', (q) => q.eq('mealPlanId', plan._id))
      .collect();

    return { weekStart, planningMode: plan.planningMode, items };
  },
});

export const getWeekPlan = query({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);

    const plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', args.weekStart)
      )
      .first();

    if (!plan) {
      return { weekStart: args.weekStart, planningMode: undefined, items: [] as any[] };
    }

    const items = await ctx.db
      .query('mealPlanItems')
      .withIndex('by_plan', (q) => q.eq('mealPlanId', plan._id))
      .collect();

    return { weekStart: args.weekStart, planningMode: plan.planningMode, items };
  },
});

export const batchAddMealPlanItems = mutation({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
    planningMode: v.optional(v.union(v.literal('all'), v.literal('lunchDinner'), v.literal('dinnerOnly'))),
    items: v.array(
      v.object({
        title: v.string(),
        day: v.string(),
        slot: v.optional(v.string()),
        recipeId: v.optional(v.id('recipes')),
        notes: v.optional(v.string()),
        mealType: v.optional(v.union(
          v.literal('recipe'),
          v.literal('leftovers'),
          v.literal('eatOut'),
          v.literal('skip'),
          v.literal('other')
        )),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();

    let plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', args.weekStart)
      )
      .first();

    if (!plan) {
      const id = await ctx.db.insert('mealPlans', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart: args.weekStart,
        planningMode: args.planningMode,
        createdAt: now,
        updatedAt: now,
      });
      plan = await ctx.db.get(id);
    } else {
      await ctx.db.patch(plan._id, {
        planningMode: args.planningMode ?? plan.planningMode,
        updatedAt: now,
      });
    }

    if (!plan) throw new Error('Meal plan not found');

    for (const item of args.items) {
      // Replace existing item for the same day+slot if present
      const existing = await ctx.db
        .query('mealPlanItems')
        .withIndex('by_plan', (q) => q.eq('mealPlanId', plan!._id))
        .filter((q) =>
          q.and(
            q.eq(q.field('day'), item.day),
            q.eq(q.field('slot'), item.slot)
          )
        )
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          title: item.title,
          recipeId: item.recipeId,
          notes: item.notes,
          mealType: item.mealType,
        });
      } else {
        await ctx.db.insert('mealPlanItems', {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          mealPlanId: plan._id,
          title: item.title,
          day: item.day,
          slot: item.slot,
          recipeId: item.recipeId,
          notes: item.notes,
          mealType: item.mealType,
        });
      }
    }

    await ctx.db.patch(plan._id, { updatedAt: now });
    return { planId: plan._id };
  },
});

export const clearWeekMealPlanItems = mutation({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);

    const plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', args.weekStart)
      )
      .first();

    if (!plan) return;

    const items = await ctx.db
      .query('mealPlanItems')
      .withIndex('by_plan', (q) => q.eq('mealPlanId', plan._id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.patch(plan._id, { updatedAt: Date.now() });
  },
});

export const getShoppingListCurrentWeek = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = await resolveCurrentPlanWeekStart(ctx, owner);
    return await getShoppingListForWeekData(ctx, owner, weekStart);
  },
});

export const getShoppingListForWeek = query({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = resolveShoppingWeekStart(args.weekStart);
    return await getShoppingListForWeekData(ctx, owner, weekStart);
  },
});

export const generateShoppingListInternal = mutation({
  args: ownerArgs,
  handler: async (ctx, args): Promise<{ planId: Id<'mealPlans'> }> => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = await resolveCurrentPlanWeekStart(ctx, owner);
    const result: { planId: Id<'mealPlans'> } = await ctx.runMutation(
      api.mealPlans.generateShoppingListInternalForWeek,
      {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
      }
    );
    return result;
  },
});

export const generateShoppingListInternalForWeek = mutation({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = resolveShoppingWeekStart(args.weekStart);
    const now = Date.now();
    let plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', weekStart)
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

    const allPlanItems = await ctx.db
      .query('mealPlanItems')
      .filter((q) => q.eq(q.field('mealPlanId'), plan!._id))
      .collect();

    // Only include recipe items (or items with no mealType, for backwards compat) in the shopping list
    const planItems = allPlanItems.filter(
      (item) => !item.mealType || item.mealType === 'recipe'
    );

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
        estimatedCost = estimateCostFromUnitPrice(latestPriceValue, quantity, item.unit);
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
    const weekStart = await resolveCurrentPlanWeekStart(ctx, owner);
    return await listShoppingListItemsForWeekData(ctx, owner, weekStart);
  },
});

export const listShoppingListItemsForWeekInternal = query({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = resolveShoppingWeekStart(args.weekStart);
    return await listShoppingListItemsForWeekData(ctx, owner, weekStart);
  },
});

export const replaceShoppingListItemsForWeek = mutation({
  args: {
    ...ownerArgs,
    weekStart: v.string(),
    items: v.array(
      v.object({
        itemName: v.string(),
        quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
        canonicalName: v.optional(v.string()),
        canonicalItemId: v.optional(v.id('canonicalItems')),
        estimatedCost: v.optional(v.number()),
        priceSource: v.optional(
          v.union(
            v.literal('receipt'),
            v.literal('walmart'),
            v.literal('ai'),
            v.literal('online'),
            v.literal('winco')
          )
        ),
        estimateConfidence: v.optional(v.number()),
        estimateSourceDetail: v.optional(v.string()),
        estimateRationale: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = resolveShoppingWeekStart(args.weekStart);
    const now = Date.now();

    let plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', weekStart)
      )
      .first();

    if (!plan) {
      const planId = await ctx.db.insert('mealPlans', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
        createdAt: now,
        updatedAt: now,
      });
      plan = await ctx.db.get(planId);
    }

    if (!plan) {
      throw new Error('Meal plan not found');
    }

    const existingItems = await ctx.db
      .query('shoppingListItems')
      .withIndex('by_plan', (q) => q.eq('mealPlanId', plan._id))
      .collect();
    for (const existingItem of existingItems) {
      await ctx.db.delete(existingItem._id);
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
    const canonicalIndex = new Map<string, (typeof canonicalItems)[number]>();

    const indexCanonicalItem = (item: (typeof canonicalItems)[number]) => {
      const names = [item.name, ...(item.aliases ?? [])];
      for (const name of names) {
        const normalized = normalizeItemName(name);
        if (normalized) canonicalIndex.set(normalized, item);
      }
    };
    for (const item of canonicalItems) indexCanonicalItem(item);

    const resolveCanonicalItemId = async (item: (typeof args.items)[number]) => {
      if (item.canonicalItemId) return item.canonicalItemId;

      const candidates = [item.canonicalName, item.itemName]
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0));

      for (const candidate of candidates) {
        const normalized = normalizeItemName(candidate);
        if (!normalized) continue;
        const existing = canonicalIndex.get(normalized);
        if (existing) return existing._id;
      }

      const canonicalName = item.canonicalName?.trim() || item.itemName.trim();
      if (!canonicalName.length) return undefined;
      const aliases =
        canonicalName !== item.itemName.trim() && item.itemName.trim().length
          ? [item.itemName.trim()]
          : undefined;

      const canonicalId = await ctx.db.insert('canonicalItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        name: canonicalName,
        aliases,
        createdAt: now,
        updatedAt: now,
      });
      const created = await ctx.db.get(canonicalId);
      if (created) indexCanonicalItem(created);
      return canonicalId;
    };

    for (const item of args.items) {
      const trimmedName = item.itemName.trim();
      if (!trimmedName.length) continue;
      const canonicalItemId = await resolveCanonicalItemId(item);

      await ctx.db.insert('shoppingListItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        mealPlanId: plan._id,
        canonicalItemId,
        itemName: trimmedName,
        quantity: item.quantity,
        unit: item.unit,
        estimatedCost: item.estimatedCost,
        priceSource: item.priceSource,
        estimateConfidence: item.estimateConfidence,
        estimateSourceDetail: item.estimateSourceDetail,
        estimateRationale: item.estimateRationale,
        isChecked: false,
      });
    }
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
    priceSource: v.optional(
      v.union(
        v.literal('receipt'),
        v.literal('walmart'),
        v.literal('ai'),
        v.literal('online'),
        v.literal('winco')
      )
    ),
    estimateConfidence: v.optional(v.number()),
    estimateSourceDetail: v.optional(v.string()),
    estimateRationale: v.optional(v.string()),
    persistPriceRecord: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== owner.ownerId || item.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }

    await ctx.db.patch(args.itemId, {
      estimatedCost: args.estimatedCost,
      priceSource: args.priceSource ?? 'walmart',
      estimateConfidence: args.estimateConfidence,
      estimateSourceDetail: args.estimateSourceDetail,
      estimateRationale: args.estimateRationale,
    });

    const canonicalItemId = args.canonicalItemId ?? item.canonicalItemId;
    if (canonicalItemId && args.persistPriceRecord !== false) {
      await ctx.db.insert('itemPrices', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        canonicalItemId,
        price: args.unitPrice,
        currency: args.currency ?? 'USD',
        source: args.priceSource ?? 'walmart',
        isEstimated: true,
        purchasedAt: Date.now(),
      });
    }
  },
});

export const addShoppingListItem = mutation({
  args: {
    ...ownerArgs,
    weekStart: v.optional(v.string()),
    itemName: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = resolveShoppingWeekStart(args.weekStart);
    const now = Date.now();

    let plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', weekStart)
      )
      .first();

    if (!plan) {
      const planId = await ctx.db.insert('mealPlans', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
        createdAt: now,
        updatedAt: now,
      });
      plan = await ctx.db.get(planId);
    }

    if (!plan) {
      throw new Error('Meal plan not found');
    }

    const trimmedName = args.itemName.trim();
    if (!trimmedName.length) {
      throw new Error('Item name is required');
    }

    await ctx.db.insert('shoppingListItems', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      mealPlanId: plan._id,
      itemName: trimmedName,
      quantity: args.quantity,
      unit: args.unit,
      estimatedCost: args.estimatedCost,
      isChecked: false,
    });
  },
});

export const generateShoppingList = action({
  args: {
    ...ownerArgs,
    weekStart: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ status: 'ok'; planId: Id<'mealPlans'>; onlineLookups: number }> => {
    const owner = await resolveOwner(ctx, args);
    const currentWeek: { weekStart: string; planningMode?: string; items: any[] } =
      await ctx.runQuery(api.mealPlans.getCurrentWeek, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });
    const weekStart = args.weekStart ?? currentWeek.weekStart;
    const { planId }: { planId: Id<'mealPlans'> } = await ctx.runMutation(
      api.mealPlans.generateShoppingListInternalForWeek,
      {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
      }
    );

    let canUsePaidFeatures = true;
    try {
      await requireSignedIn(ctx);
    } catch {
      canUsePaidFeatures = false;
    }

    let items: Doc<'shoppingListItems'>[] = await ctx.runQuery(
      api.mealPlans.listShoppingListItemsForWeekInternal,
      {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart,
      }
    );

    const aiMergeEnabled =
      canUsePaidFeatures &&
      isFeatureEnabled(process.env.AI_SHOPPING_LIST_V2_ENABLED, true) &&
      Boolean(process.env.OPENAI_API_KEY);
    const aiModel =
      process.env.OPENAI_SHOPPING_LIST_MODEL ??
      process.env.OPENAI_PRICE_MODEL ??
      process.env.OPENAI_MODEL ??
      'gpt-5-mini';

    if (aiMergeEnabled && items.length) {
      const weekPlan: { weekStart: string; planningMode?: string; items: any[] } =
        await ctx.runQuery(api.mealPlans.getWeekPlan, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
        });

      const recipeIds = Array.from(
        new Set(
          (weekPlan.items ?? [])
            .filter((item) => !item.mealType || item.mealType === 'recipe')
            .map((item) => item.recipeId)
            .filter((recipeId): recipeId is Id<'recipes'> => Boolean(recipeId))
        )
      );

      const recipeDetailById = new Map<Id<'recipes'>, { ingredients: Array<any> }>();
      for (const recipeId of recipeIds) {
        const detail = await ctx.runQuery(api.recipes.getDetail, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          recipeId,
        });
        if (detail) {
          recipeDetailById.set(recipeId, { ingredients: detail.ingredients ?? [] });
        }
      }

      const canonicalItems: Doc<'canonicalItems'>[] = await ctx.runQuery(
        api.receipts.listCanonicalItemsInternal,
        {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
        }
      );
      const pantryItems: Doc<'pantryItems'>[] = await ctx.runQuery(api.pantry.list, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });

      const mergedDraft = await mergeShoppingListWithAi({
        model: aiModel,
        context: {
          weekStart,
          draftItems: items.map((item) => ({
            itemName: item.itemName,
            quantity: item.quantity ?? undefined,
            unit: item.unit ?? undefined,
          })),
          meals: (weekPlan.items ?? [])
            .filter((item) => !item.mealType || item.mealType === 'recipe')
            .map((item) => {
              const recipeIngredients = item.recipeId
                ? recipeDetailById.get(item.recipeId as Id<'recipes'>)?.ingredients ?? []
                : [];
              return {
                day: item.day,
                slot: item.slot,
                title: item.title,
                ingredients:
                  recipeIngredients.length > 0
                    ? recipeIngredients.map((ingredient) => ({
                        name: ingredient.name,
                        quantity: ingredient.quantity ?? undefined,
                        unit: ingredient.unit ?? undefined,
                      }))
                    : [{ name: item.title }],
              };
            }),
          canonicalNames: canonicalItems
            .map((item) => item.name)
            .filter((name): name is string => Boolean(name))
            .slice(0, 250),
          pantryItems: pantryItems.map((item) => ({
            name: item.name,
            quantity: item.quantity ?? undefined,
            unit: item.unit ?? undefined,
          })),
        },
        fallbackDraft: items.map((item) => ({
          itemName: item.itemName,
          quantity: item.quantity ?? undefined,
          unit: item.unit ?? undefined,
        })),
      });

      if (mergedDraft.length) {
        const originalByName = new Map<string, Id<'canonicalItems'>>();
        for (const item of items) {
          const normalized = normalizeItemName(item.itemName);
          if (normalized && item.canonicalItemId && !originalByName.has(normalized)) {
            originalByName.set(normalized, item.canonicalItemId);
          }
        }

        await ctx.runMutation(api.mealPlans.replaceShoppingListItemsForWeek, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
          items: mergedDraft.map((item: ShoppingListMergeItemDraft) => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unit: item.unit,
            canonicalItemId: (() => {
              const normalized = normalizeItemName(item.itemName);
              if (!normalized) return undefined;
              return originalByName.get(normalized);
            })(),
          })),
        });

        items = await ctx.runQuery(api.mealPlans.listShoppingListItemsForWeekInternal, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
        });
      }
    }

    const walmartBaseUrl = process.env.WALMART_API_BASE_URL;
    const walmartApiKey = process.env.WALMART_API_KEY;
    const walmartApiKeyHeader = process.env.WALMART_API_KEY_HEADER;
    const walmartHostHeader = process.env.WALMART_API_HOST_HEADER;
    const walmartHostValue = process.env.WALMART_API_HOST_VALUE;
    const walmartQueryParam = process.env.WALMART_QUERY_PARAM;
    const priceUnitRaw =
      process.env.WALMART_PRICE_UNIT ??
      process.env.PRICE_LOOKUP_PRICE_UNIT;
    const priceUnit =
      priceUnitRaw === 'cents' || priceUnitRaw === 'dollars' ? priceUnitRaw : undefined;
    const walmartEnabled =
      canUsePaidFeatures &&
      isFeatureEnabled(process.env.WALMART_LOOKUP_ENABLED, false) &&
      Boolean(walmartBaseUrl);

    if (!canUsePaidFeatures) {
      return { status: 'ok', planId, onlineLookups: 0 };
    }

    const pricingInputs: PricingEvidenceInput[] = [];
    let onlineLookups = 0;

    for (const item of items) {
      const evidence: PricingEvidenceInput['evidence'] = {};

      if (item.canonicalItemId) {
        const latest = await ctx.runQuery(api.prices.getLatestPurchasePrice, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          canonicalItemId: item.canonicalItemId,
        });
        if (latest?.price !== undefined && latest?.price !== null) {
          evidence.receiptUnitPrice = latest.price;
        } else {
          const fallback = await ctx.runQuery(api.prices.getForItem, {
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            canonicalItemId: item.canonicalItemId,
          });
          if (fallback?.price !== undefined && fallback?.price !== null) {
            if (fallback.source === 'receipt' && !fallback.isEstimated) {
              evidence.receiptUnitPrice = fallback.price;
            } else if (fallback.source === 'walmart') {
              evidence.walmartUnitPrice = fallback.price;
            } else if (fallback.source === 'ai') {
              evidence.aiUnitPrice = fallback.price;
            } else if (fallback.source === 'winco') {
              evidence.legacyWincoUnitPrice = fallback.price;
            } else {
              evidence.legacyOnlineUnitPrice = fallback.price;
            }
          }
        }
      }

      if (
        evidence.receiptUnitPrice === undefined &&
        evidence.walmartUnitPrice === undefined &&
        walmartEnabled &&
        walmartBaseUrl
      ) {
        try {
          const walmart = await lookupWalmartPrice(item.itemName, {
            baseUrl: walmartBaseUrl,
            apiKey: walmartApiKey,
            apiKeyHeader: walmartApiKeyHeader,
            hostHeader: walmartHostHeader,
            hostValue: walmartHostValue,
            queryParam: walmartQueryParam,
            priceUnit,
          });
          if (walmart.price !== undefined && walmart.price !== null) {
            evidence.walmartUnitPrice = normalizePrice(walmart.price, walmart.priceUnit);
            onlineLookups += 1;
          }
        } catch {
          // Ignore Walmart lookup failures and fall back to AI estimate.
        }
      }

      pricingInputs.push({
        itemName: item.itemName,
        canonicalName: item.itemName,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        evidence,
      });
    }

    const aiPricingEnabled =
      canUsePaidFeatures &&
      isFeatureEnabled(process.env.AI_PRICE_ESTIMATE_V2_ENABLED, true) &&
      Boolean(process.env.OPENAI_API_KEY);
    const pricing = aiPricingEnabled
      ? await estimatePricingWithAi({
          model: aiModel,
          contextLabel: `shopping_list_${weekStart}`,
          inputs: pricingInputs,
        })
      : finalizePricingFromEvidence(pricingInputs);

    const estimateIndex = new Map<string, (typeof pricing.items)[number]>();
    for (const estimate of pricing.items) {
      const normalizedName = normalizeItemName(estimate.itemName) || estimate.itemName.toLowerCase();
      const normalizedUnit = (estimate.unit ?? '').toLowerCase();
      estimateIndex.set(`${normalizedName}:${normalizedUnit}`, estimate);
      estimateIndex.set(normalizedName, estimate);
    }

    for (const item of items) {
      const normalizedName = normalizeItemName(item.itemName) || item.itemName.toLowerCase();
      const normalizedUnit = (item.unit ?? '').toLowerCase();
      const estimate =
        estimateIndex.get(`${normalizedName}:${normalizedUnit}`) ?? estimateIndex.get(normalizedName);
      if (!estimate || estimate.estimatedCost === undefined) continue;

      const unitPrice = estimate.unitPrice ?? estimate.estimatedCost;
      if (unitPrice === undefined) continue;

      await ctx.runMutation(api.mealPlans.applyShoppingListOnlinePrice, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        itemId: item._id,
        canonicalItemId: item.canonicalItemId ?? undefined,
        estimatedCost: estimate.estimatedCost,
        unitPrice,
        currency: pricing.currency,
        priceSource: normalizePriceSource(estimate.source),
        estimateConfidence:
          estimate.source === 'ai'
            ? Math.min(estimate.confidence ?? 0.35, 0.49)
            : estimate.confidence,
        estimateSourceDetail:
          estimate.source === 'online'
            ? 'legacy_online'
            : estimate.source === 'winco'
              ? 'legacy_winco'
              : estimate.source === 'ai'
                ? 'ai_inferred'
                : estimate.source,
        estimateRationale: estimate.rationale,
        persistPriceRecord: estimate.source !== 'receipt' && estimate.source !== 'missing',
      });
    }

    return { status: 'ok', planId, onlineLookups };
  },
});

export const addMealPlanItem = mutation({
  args: {
    ...ownerArgs,
    weekStart: v.optional(v.string()),
    title: v.string(),
    day: v.string(),
    slot: v.optional(v.string()),
    recipeId: v.optional(v.id('recipes')),
    notes: v.optional(v.string()),
    mealType: v.optional(v.union(
      v.literal('recipe'),
      v.literal('leftovers'),
      v.literal('eatOut'),
      v.literal('skip'),
      v.literal('other')
    )),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const weekStart = args.weekStart ?? formatDate(getWeekStart());
    const now = Date.now();

    let plan = await ctx.db
      .query('mealPlans')
      .withIndex('by_owner_week', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('weekStart', weekStart)
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
      mealType: args.mealType,
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
    mealType: v.optional(v.union(
      v.literal('recipe'),
      v.literal('leftovers'),
      v.literal('eatOut'),
      v.literal('skip'),
      v.literal('other')
    )),
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
      mealType: args.mealType,
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

export const updateShoppingListItem = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('shoppingListItems'),
    itemName: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    estimatedCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error('Shopping list item not found');
    if (item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }
    const trimmedName = args.itemName.trim();
    if (!trimmedName.length) {
      throw new Error('Item name is required');
    }
    await ctx.db.patch(args.itemId, {
      itemName: trimmedName,
      quantity: args.quantity,
      unit: args.unit,
      estimatedCost: args.estimatedCost,
    });
  },
});

export const deleteShoppingListItem = mutation({
  args: {
    ...ownerArgs,
    itemId: v.id('shoppingListItems'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error('Shopping list item not found');
    if (item.ownerType !== owner.ownerType || item.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }
    await ctx.db.delete(args.itemId);
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
