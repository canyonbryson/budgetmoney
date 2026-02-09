import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { api } from './_generated/api';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';
import { callOpenAIJson } from './openai';
import { lookupSpoonacularPrice } from './priceProviders/spoonacular';

type RecipeIngredientParse = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  confidence?: number | null;
  canonical_name?: string | null;
};

type RecipeParseResult = {
  title?: string | null;
  servings?: number | null;
  ingredients: RecipeIngredientParse[];
  notes?: string | null;
  confidence?: number | null;
};

const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ingredients'],
  properties: {
    title: { type: ['string', 'null'] },
    servings: { type: ['number', 'null'] },
    notes: { type: ['string', 'null'] },
    confidence: { type: ['number', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          confidence: { type: ['number', 'null'] },
          canonical_name: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

function normalizeItemName(name: string) {
  const cleaned = name.toLowerCase();
  const withoutSizes = cleaned.replace(
    /\b\d+(\.\d+)?\s*(oz|ounce|ounces|lb|lbs|pound|pounds|ct|count|pack|pkg|pk|g|kg|mg|ml|l)\b/g,
    ' '
  );
  return withoutSizes.replace(/[^a-z0-9%]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function loadCanonicalIndex(
  ctx: any,
  owner: { ownerType: 'device' | 'user'; ownerId: string }
) {
  const canonicalItems = await ctx.db
    .query('canonicalItems')
    .filter((q: any) =>
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

  return { canonicalItems, canonicalIndex, indexCanonicalItem };
}

async function ensureCanonicalItem(
  ctx: any,
  owner: { ownerType: 'device' | 'user'; ownerId: string },
  canonicalIndex: Map<string, any>,
  indexCanonicalItem: (item: any) => void,
  canonicalName: string,
  alias: string
) {
  const canonicalNormalized = normalizeItemName(canonicalName);
  const aliasNormalized = normalizeItemName(alias);
  const existing =
    (canonicalNormalized && canonicalIndex.get(canonicalNormalized)) ||
    (aliasNormalized && canonicalIndex.get(aliasNormalized));

  if (existing) {
    const aliases = existing.aliases ?? [];
    const aliasExists = aliases.some(
      (current: string) => normalizeItemName(current) === aliasNormalized
    );
    if (!aliasExists && alias && alias !== existing.name) {
      const updatedAliases = [...aliases, alias];
      await ctx.db.patch(existing._id, {
        aliases: updatedAliases,
        updatedAt: Date.now(),
      });
      existing.aliases = updatedAliases;
      indexCanonicalItem(existing);
    }
    return existing._id;
  }

  const now = Date.now();
  const canonicalLabel = canonicalName.trim() || alias.trim() || 'item';
  const aliases = alias && alias !== canonicalLabel ? [alias] : [];
  const newId = await ctx.db.insert('canonicalItems', {
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    name: canonicalLabel,
    aliases,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(newId);
  if (created) indexCanonicalItem(created);
  return newId;
}

function extractJsonLdBlocks(html: string) {
  const blocks: string[] = [];
  const regex = /<script[^>]*type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html))) {
    const block = match[1]?.trim();
    if (block) blocks.push(block);
  }
  return blocks;
}

function extractHtmlTitle(html: string) {
  const match = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return match?.[1]?.trim() ?? undefined;
}

function truncateText(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizePrice(value: number, unit?: 'cents' | 'dollars') {
  if (unit === 'cents') return value / 100;
  return value;
}

export const list = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('recipes')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
  },
});

export const getDetail = query({
  args: {
    ...ownerArgs,
    recipeId: v.id('recipes'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.ownerId !== owner.ownerId || recipe.ownerType !== owner.ownerType) {
      return null;
    }

    const ingredients = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe', (q) => q.eq('recipeId', recipe._id))
      .collect();

    return { recipe, ingredients };
  },
});

export const importFromUrl = action({
  args: {
    ...ownerArgs,
    url: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);

    let content = '';
    try {
      const response = await fetch(args.url);
      if (!response.ok) {
        throw new Error(`Fetch failed: ${response.status}`);
      }
      content = await response.text();
    } catch {
      content = `Recipe from ${args.url}`;
    }

    const canonicalItems = await ctx.runQuery(api.receipts.listCanonicalItemsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    });

    const canonicalNames = canonicalItems
      .map((item: any) => item.name)
      .filter((name: string) => name)
      .slice(0, 200);

    const jsonLd = extractJsonLdBlocks(content)
      .slice(0, 3)
      .map((block) => truncateText(block, 4000));
    const htmlTitle = extractHtmlTitle(content);

    const systemPrompt = [
      'You are a precise recipe parser.',
      'Extract recipe title, servings, notes, and a list of ingredients.',
      'For each ingredient, provide a canonical item name (generic, singular, unbranded).',
      'If you are unsure about quantity or unit, set them to null.',
    ].join(' ');

    const userPromptParts = [
      `URL: ${args.url}`,
      canonicalNames.length > 0
        ? `Prefer these existing canonical item names when they match: ${canonicalNames.join(', ')}`
        : 'There are no existing canonical items yet.',
      jsonLd.length > 0 ? `JSON-LD:\n${jsonLd.join('\n\n')}` : '',
      `HTML (truncated):\n${truncateText(content, 20000)}`,
    ].filter((part) => part.length > 0);

    const model = process.env.OPENAI_RECIPE_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const parsed = await callOpenAIJson<RecipeParseResult>({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPromptParts.join('\n\n') }],
        },
      ],
      schema: {
        name: 'recipe_parse',
        schema: RECIPE_SCHEMA,
        strict: true,
      },
      temperature: 0.1,
      maxOutputTokens: 1400,
    });

    const title =
      toOptionalString(parsed.title ?? null) ??
      htmlTitle ??
      args.url.replace(/^https?:\/\//, '').slice(0, 60);

    const ingredients = (parsed.ingredients ?? []).map((ingredient) => ({
      name: toOptionalString(ingredient.name) ?? 'Unknown ingredient',
      quantity: toOptionalNumber(ingredient.quantity ?? null),
      unit: toOptionalString(ingredient.unit ?? null),
      confidence: toOptionalNumber(ingredient.confidence ?? null),
      canonicalName: toOptionalString(ingredient.canonical_name ?? null),
    }));

    await ctx.runMutation(api.recipes.createParsedInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      title,
      sourceUrl: args.url,
      content,
      servings: toOptionalNumber(parsed.servings ?? null),
      notes: toOptionalString(parsed.notes ?? null),
      ingredients,
    });
  },
});

export const searchOnline = action({
  args: {
    ...ownerArgs,
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    await resolveOwner(ctx, args);

    const base =
      process.env.RECIPE_SEARCH_BASE_URL ??
      process.env.SPOONACULAR_BASE_URL ??
      'https://api.spoonacular.com';
    const key = process.env.RECIPE_SEARCH_API_KEY ?? process.env.SPOONACULAR_API_KEY;
    if (!key) {
      throw new Error('Missing recipe search API key');
    }

    const url = new URL('/recipes/complexSearch', base);
    url.searchParams.set('query', args.query);
    url.searchParams.set('number', String(args.limit ?? 6));
    url.searchParams.set('addRecipeInformation', 'true');
    url.searchParams.set('apiKey', key);

    const response = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Recipe search failed: ${response.status}`);
    }
    const json = await response.json();
    const results = Array.isArray(json?.results) ? json.results : [];

    return results.map((result: any) => ({
      id: result.id,
      title: result.title,
      image: result.image,
      sourceUrl: result.sourceUrl ?? result.spoonacularSourceUrl ?? null,
    }));
  },
});

export const createInternal = mutation({
  args: {
    ...ownerArgs,
    title: v.string(),
    sourceUrl: v.optional(v.string()),
    content: v.string(),
    servings: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  returns: v.id('recipes'),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    return await ctx.db.insert('recipes', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      title: args.title,
      sourceUrl: args.sourceUrl,
      content: args.content,
      servings: args.servings,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createParsedInternal = mutation({
  args: {
    ...ownerArgs,
    title: v.string(),
    sourceUrl: v.optional(v.string()),
    content: v.string(),
    servings: v.optional(v.number()),
    notes: v.optional(v.string()),
    ingredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
        confidence: v.optional(v.number()),
        canonicalName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();

    const recipeId = await ctx.db.insert('recipes', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      title: args.title,
      sourceUrl: args.sourceUrl,
      content: args.content,
      servings: args.servings,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    const { canonicalIndex, indexCanonicalItem } = await loadCanonicalIndex(ctx, owner);

    for (const ingredient of args.ingredients) {
      const canonicalName = (ingredient.canonicalName ?? ingredient.name).trim() || ingredient.name;
      const canonicalId = await ensureCanonicalItem(
        ctx,
        owner,
        canonicalIndex,
        indexCanonicalItem,
        canonicalName,
        ingredient.name
      );

      await ctx.db.insert('recipeIngredients', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        recipeId,
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        normalizedItemId: canonicalId,
        confidence: ingredient.confidence,
      });
    }

    return recipeId;
  },
});

export const update = mutation({
  args: {
    ...ownerArgs,
    recipeId: v.id('recipes'),
    title: v.string(),
    content: v.string(),
    servings: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.ownerId !== owner.ownerId || recipe.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    const title = args.title.trim() || recipe.title;
    const content = args.content.trim() || recipe.content;
    const notes = args.notes?.trim() || undefined;
    const servings = args.servings;

    await ctx.db.patch(args.recipeId, {
      title,
      content,
      notes,
      servings,
      updatedAt: Date.now(),
    });
  },
});

export const setIngredients = mutation({
  args: {
    ...ownerArgs,
    recipeId: v.id('recipes'),
    ingredients: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.ownerId !== owner.ownerId || recipe.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }

    const existing = await ctx.db
      .query('recipeIngredients')
      .withIndex('by_recipe', (q) => q.eq('recipeId', recipe._id))
      .collect();
    for (const ingredient of existing) {
      await ctx.db.delete(ingredient._id);
    }

    const { canonicalIndex, indexCanonicalItem } = await loadCanonicalIndex(ctx, owner);

    for (const ingredient of args.ingredients) {
      const name = ingredient.name.trim();
      if (!name) continue;
      const canonicalId = await ensureCanonicalItem(
        ctx,
        owner,
        canonicalIndex,
        indexCanonicalItem,
        name,
        name
      );
      await ctx.db.insert('recipeIngredients', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        recipeId: recipe._id,
        name,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        normalizedItemId: canonicalId,
        confidence: 1,
      });
    }

    await ctx.db.patch(recipe._id, { updatedAt: Date.now() });
  },
});

export const estimateCost = action({
  args: {
    ...ownerArgs,
    recipeId: v.id('recipes'),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalCost: number;
    costPerServing: number;
    currency: string;
    receiptCount: number;
    onlineCount: number;
    missingCount: number;
    confidence: number;
    sources: { source: 'receipt' | 'online' | 'missing'; count: number }[];
  }> => {
    const owner = await resolveOwner(ctx, args);
    const detail: { recipe: Doc<'recipes'>; ingredients: Doc<'recipeIngredients'>[] } | null =
      await ctx.runQuery(api.recipes.getDetail, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      recipeId: args.recipeId,
      });
    if (!detail) throw new Error('Recipe not found');

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

    if (!key) {
      canLookup = false;
    }

    let totalCost = 0;
    let missingCount = 0;
    let onlineCount = 0;
    let receiptCount = 0;
    const maxLookups = 10;
    let usedLookups = 0;

    for (const ingredient of detail.ingredients) {
      const quantity = ingredient.quantity ?? 1;
      let unitPrice: number | undefined;

      if (ingredient.normalizedItemId) {
        const latest = await ctx.runQuery(api.prices.getLatestPurchasePrice, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          canonicalItemId: ingredient.normalizedItemId,
        });
        if (latest?.price !== undefined && latest?.price !== null) {
          unitPrice = latest.price;
          receiptCount += 1;
        }
      }

      if (unitPrice === undefined && canLookup && usedLookups < maxLookups) {
        usedLookups += 1;
        try {
          const result = await lookupSpoonacularPrice(ingredient.name, {
            apiKey: key!,
            baseUrl: base,
            priceUnit,
          });
          if (result.price !== undefined && result.price !== null) {
            unitPrice = normalizePrice(result.price, result.priceUnit);
            onlineCount += 1;
            if (ingredient.normalizedItemId && unitPrice !== undefined) {
              await ctx.runMutation(api.prices.recordOnlineEstimate, {
                ownerType: owner.ownerType,
                ownerId: owner.ownerId,
                canonicalItemId: ingredient.normalizedItemId,
                price: unitPrice,
                currency: result.currency ?? 'USD',
              });
            }
          }
        } catch {
          // Ignore lookup failures.
        }
      }

      if (unitPrice === undefined) {
        missingCount += 1;
        continue;
      }

      totalCost += unitPrice * quantity;
    }

    const servings = detail.recipe.servings ?? 1;
    const costPerServing = servings > 0 ? totalCost / servings : totalCost;
    const ingredientCount = detail.ingredients.length;
    const confidenceRaw =
      ingredientCount > 0
        ? (receiptCount + onlineCount * 0.6) / ingredientCount
        : 0;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));

    return {
      totalCost: roundCurrency(totalCost),
      costPerServing: roundCurrency(costPerServing),
      currency: 'USD',
      receiptCount,
      onlineCount,
      missingCount,
      confidence,
      sources: [
        { source: 'receipt', count: receiptCount },
        { source: 'online', count: onlineCount },
        { source: 'missing', count: missingCount },
      ],
    };
  },
});
