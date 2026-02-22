import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { api } from './_generated/api';
import { ownerArgs, resolveOwner, requireSignedIn, type Owner } from './ownership';
import { callOpenAIJson } from './openai';
import { lookupWalmartPrice } from './priceProviders/walmart';
import {
  estimatePricingWithAi,
  finalizePricingFromEvidence,
  type PricingEvidenceInput,
} from './ai/pricing';
import { normalizeRecipeIngredientsForSave } from './lib/recipeValidation';
import { load, type CheerioAPI } from 'cheerio';

type RecipeIngredientParse = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  confidence?: number | null;
  canonical_name?: string | null;
};

type RecipeParseResult = {
  name?: string | null;
  servings?: number | null;
  instructions?: string | null;
  price_per_serving?: number | null;
  ingredients: RecipeIngredientParse[];
  notes?: string | null;
  tags?: string[] | null;
  confidence?: number | null;
};

type ExtractedRecipe = {
  name?: string;
  servings?: number | null;
  ingredientLines: string[];
  instructionSteps: string[];
  tags?: string[];
  source: 'jsonld' | 'dom' | 'heuristic' | 'none';
};

type ParsedIngredientLine = {
  quantity?: number;
  unit?: string;
  name: string;
};

export const RECIPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'servings',
    'instructions',
    'ingredients',
    'price_per_serving',
    'notes',
    'tags',
    'confidence',
  ],
  properties: {
    name: { type: ['string', 'null'] },
    servings: { type: ['number', 'null'] },
    instructions: { type: ['string', 'null'] },
    price_per_serving: { type: ['number', 'null'] },
    notes: { type: ['string', 'null'] },
    tags: {
      type: ['array', 'null'],
      items: { type: 'string' },
    },
    confidence: { type: ['number', 'null'] },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'confidence', 'canonical_name'],
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

function normalizeTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  const normalized = Array.from(
    new Set(
      tags
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter((tag) => tag.length > 0)
    )
  );
  return normalized.length ? normalized : undefined;
}

function getRecipeName(recipe: any) {
  return toOptionalString(recipe?.name) ?? toOptionalString(recipe?.title) ?? 'Recipe';
}

function getRecipeInstructions(recipe: any) {
  return toOptionalString(recipe?.instructions) ?? toOptionalString(recipe?.content) ?? '';
}

function toRecipeOutput(recipe: any) {
  return {
    ...recipe,
    name: getRecipeName(recipe),
    instructions: getRecipeInstructions(recipe),
    tags: normalizeTags(recipe?.tags) ?? [],
  };
}

async function loadCanonicalIndex(
  ctx: any,
  owner: Owner
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
  owner: Owner,
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

function isFeatureEnabled(value: string | undefined, enabledWhenMissing = true) {
  if (!value) return enabledWhenMissing;
  const normalized = value.trim().toLowerCase();
  return normalized !== 'false' && normalized !== '0' && normalized !== 'off';
}

function normalizePrice(value: number, unit?: 'cents' | 'dollars') {
  if (unit === 'cents') return value / 100;
  return value;
}

export function buildIngredientLookupQueries(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];

  const prepWordsPattern =
    /\b(finely|roughly|thinly|thickly|small|medium|large|fresh|freshly|ground|crushed|chopped|minced|diced|shredded|grated|peeled|seeded|cubed|sliced|boneless|skinless|cooked|uncooked|to taste)\b/gi;

  const withoutBrackets = trimmed
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const beforeSemicolon = withoutBrackets.split(';')[0]?.trim() ?? '';
  const beforeComma = beforeSemicolon.split(',')[0]?.trim() ?? '';
  const withoutPrep = beforeComma.replace(prepWordsPattern, ' ').replace(/\s+/g, ' ').trim();
  const normalized = normalizeItemName(beforeComma);

  const candidates = [
    trimmed,
    withoutBrackets,
    beforeSemicolon,
    beforeComma,
    withoutPrep,
    normalized,
  ].filter((value): value is string => Boolean(value));

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }
  return unique;
}

function safeJsonParse<T = any>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function flattenJsonLd(input: any) {
  const out: any[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node !== 'object') return;
    if (Array.isArray(node['@graph'])) visit(node['@graph']);
    out.push(node);
    for (const value of Object.values(node)) {
      if (value && typeof value === 'object') visit(value);
    }
  };
  visit(input);
  return out;
}

function hasType(node: any, type: string) {
  const rawType = node?.['@type'];
  if (!rawType) return false;
  if (typeof rawType === 'string') return rawType.toLowerCase() === type.toLowerCase();
  if (Array.isArray(rawType)) {
    return rawType.some((entry) => String(entry).toLowerCase() === type.toLowerCase());
  }
  return false;
}

function pickBestRecipeNode(nodes: any[]) {
  const recipes = nodes.filter((node) => hasType(node, 'Recipe'));
  if (!recipes.length) return null;
  recipes.sort((left, right) => {
    const leftIngredients = Array.isArray(left?.recipeIngredient) ? left.recipeIngredient.length : 0;
    const rightIngredients = Array.isArray(right?.recipeIngredient) ? right.recipeIngredient.length : 0;
    const leftSteps = Array.isArray(left?.recipeInstructions) ? left.recipeInstructions.length : 0;
    const rightSteps = Array.isArray(right?.recipeInstructions) ? right.recipeInstructions.length : 0;
    return rightIngredients + rightSteps - (leftIngredients + leftSteps);
  });
  return recipes[0];
}

function extractStepsFromRecipeInstructions(raw: any): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map((step) => step.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    const steps: string[] = [];
    for (const item of raw) {
      if (typeof item === 'string') {
        const trimmed = item.trim();
        if (trimmed) steps.push(trimmed);
        continue;
      }
      const text = toOptionalString(item?.text) ?? toOptionalString(item?.name);
      if (text) steps.push(text);
      if (Array.isArray(item?.itemListElement)) {
        for (const nested of item.itemListElement) {
          const nestedText = toOptionalString(nested?.text) ?? toOptionalString(nested?.name);
          if (nestedText) steps.push(nestedText);
        }
      }
    }
    return steps;
  }
  if (Array.isArray(raw?.itemListElement)) {
    return raw.itemListElement
      .map((item: any) => toOptionalString(item?.text) ?? toOptionalString(item?.name))
      .filter((item: string | undefined): item is string => Boolean(item));
  }
  return [];
}

function parseServings(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

const FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '⅓': 1 / 3,
  '½': 0.5,
  '⅔': 2 / 3,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};

function normalizeUnicodeFractions(value: string) {
  let output = value;
  for (const [symbol, numberValue] of Object.entries(FRACTIONS)) {
    output = output.replaceAll(symbol, ` ${numberValue} `);
  }
  return output.replace(/\s+/g, ' ').trim();
}

function parseLeadingNumber(value: string): { quantity?: number; rest: string } {
  const normalized = normalizeUnicodeFractions(value);
  const hyphenMixedFraction = normalized.match(/^(\d+)-(\d+)\s*\/\s*(\d+)(\s+|$)/);
  if (hyphenMixedFraction) {
    const whole = Number(hyphenMixedFraction[1]);
    const numerator = Number(hyphenMixedFraction[2]);
    const denominator = Number(hyphenMixedFraction[3]);
    if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return {
        quantity: whole + numerator / denominator,
        rest: normalized.slice(hyphenMixedFraction[0].length).trim(),
      };
    }
  }
  const mixedSlashFraction = normalized.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)(\s+|$)/);
  if (mixedSlashFraction) {
    const whole = Number(mixedSlashFraction[1]);
    const numerator = Number(mixedSlashFraction[2]);
    const denominator = Number(mixedSlashFraction[3]);
    if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return {
        quantity: whole + numerator / denominator,
        rest: normalized.slice(mixedSlashFraction[0].length).trim(),
      };
    }
  }
  const slashFraction = normalized.match(/^(\d+)\s*\/\s*(\d+)(\s+|$)/);
  if (slashFraction) {
    const numerator = Number(slashFraction[1]);
    const denominator = Number(slashFraction[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      return {
        quantity: numerator / denominator,
        rest: normalized.slice(slashFraction[0].length).trim(),
      };
    }
  }
  const range = normalized.match(/^(\d+(\.\d+)?)(\s*(to|-)\s*)(\d+(\.\d+)?)(\s+|$)/i);
  if (range) {
    const left = Number(range[1]);
    const right = Number(range[5]);
    const quantity = Number.isFinite(left) && Number.isFinite(right) ? (left + right) / 2 : undefined;
    return { quantity, rest: normalized.slice(range[0].length).trim() };
  }
  const mixedFraction = normalized.match(/^(\d+)\s+(\d+(\.\d+)?)(\s+|$)/);
  if (mixedFraction) {
    const left = Number(mixedFraction[1]);
    const right = Number(mixedFraction[2]);
    const quantity = Number.isFinite(left) && Number.isFinite(right) ? left + right : undefined;
    return { quantity, rest: normalized.slice(mixedFraction[0].length).trim() };
  }
  const single = normalized.match(/^(\d+(\.\d+)?)(\s+|$)/);
  if (single) {
    const quantity = Number(single[1]);
    return {
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      rest: normalized.slice(single[0].length).trim(),
    };
  }
  return { rest: value.trim() };
}

const UNIT_ALIASES: Record<string, string> = {
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbsp: 'tbsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
  cup: 'cup',
  cups: 'cup',
  ounce: 'oz',
  ounces: 'oz',
  oz: 'oz',
  pound: 'lb',
  pounds: 'lb',
  lb: 'lb',
  lbs: 'lb',
  clove: 'clove',
  cloves: 'clove',
  can: 'can',
  cans: 'can',
  package: 'package',
  packages: 'package',
  pkg: 'package',
  pkgs: 'package',
  stick: 'stick',
  sticks: 'stick',
  bunch: 'bunch',
  bunches: 'bunch',
  slice: 'slice',
  slices: 'slice',
  cl: 'cl',
  packet: 'packet',
  packets: 'packet',
};

function parseUnitAndName(rest: string) {
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (!tokens.length) return { unit: undefined, name: '' };
  const first = tokens[0].toLowerCase().replace(/[^\w]/g, '');
  const unit = UNIT_ALIASES[first];
  if (unit) return { unit, name: tokens.slice(1).join(' ').trim() };
  return { unit: undefined, name: rest.trim() };
}

export function parseIngredientLine(line: string): ParsedIngredientLine {
  const cleanedLine = line.replace(/^\*\s*/, '').trim();
  if (/to taste/i.test(cleanedLine)) {
    return {
      name: cleanedLine.replace(/\bto taste\b/gi, '').replace(/\s+/g, ' ').trim() || cleanedLine,
    };
  }
  const withoutQualifier = cleanedLine.replace(/^(about|approximately|approx\.?|heaping|scant)\s+/i, '');
  const primary = parseLeadingNumber(cleanedLine);
  const fallback = parseLeadingNumber(withoutQualifier);
  const quantity = primary.quantity ?? fallback.quantity;
  const rest = primary.quantity !== undefined ? primary.rest : fallback.rest;
  const restWithoutPackageSize = rest.replace(/^\([^)]*\)\s*/, '');
  const { unit, name } = parseUnitAndName(restWithoutPackageSize);
  const resolvedName = quantity === undefined ? cleanedLine : name || restWithoutPackageSize || rest;
  return {
    quantity: toOptionalNumber(quantity),
    unit: toOptionalString(unit),
    name: toOptionalString(resolvedName) ?? cleanedLine,
  };
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function findListAfterHeading($: CheerioAPI, labels: string[]) {
  const headings = $('h1, h2, h3, h4, h5, strong, b').toArray();
  for (const element of headings) {
    const text = normalizeText($(element).text()).toLowerCase();
    if (!labels.some((label) => text.includes(label.toLowerCase()))) continue;
    const inParentList = $(element).parent().nextAll('ul,ol').first();
    if (inParentList.length) {
      const lines = inParentList
        .find('li')
        .toArray()
        .map((item) => normalizeText($(item).text()))
        .filter(Boolean);
      if (lines.length) return lines;
    }
    const nextList = $(element).nextAll('ul,ol').first();
    if (nextList.length) {
      const lines = nextList
        .find('li')
        .toArray()
        .map((item) => normalizeText($(item).text()))
        .filter(Boolean);
      if (lines.length) return lines;
    }
  }
  return [];
}

export function extractRecipeFromHtml(html: string): ExtractedRecipe {
  const $ = load(html);
  const jsonLdBlocks = extractJsonLdBlocks(html);
  const jsonNodes = jsonLdBlocks.flatMap((block) => {
    const parsed = safeJsonParse(block);
    return parsed ? flattenJsonLd(parsed) : [];
  });

  const recipeNode = pickBestRecipeNode(jsonNodes);
  if (recipeNode) {
    const ingredientLines = Array.isArray(recipeNode.recipeIngredient)
      ? recipeNode.recipeIngredient
          .map((ingredient: any) => toOptionalString(String(ingredient)))
          .filter((ingredient: string | undefined): ingredient is string => Boolean(ingredient))
      : [];
    const instructionSteps = extractStepsFromRecipeInstructions(recipeNode.recipeInstructions);
    const name = toOptionalString(recipeNode.name) ?? toOptionalString(recipeNode.headline);
    const servings = parseServings(recipeNode.recipeYield ?? recipeNode.yield);
    const tagsRaw = recipeNode.keywords ?? recipeNode.recipeCategory ?? recipeNode.recipeCuisine;
    const tags =
      typeof tagsRaw === 'string'
        ? normalizeTags(tagsRaw.split(','))
        : Array.isArray(tagsRaw)
          ? normalizeTags(tagsRaw)
          : undefined;
    if (ingredientLines.length || instructionSteps.length) {
      return { name, servings, ingredientLines, instructionSteps, tags, source: 'jsonld' };
    }
  }

  const pluginRoot = $('.wprm-recipe-container, .tasty-recipes, .mv-create-card, .recipe-card').first();
  if (pluginRoot.length) {
    const ingredientLines = pluginRoot
      .find(
        '.wprm-recipe-ingredient, .tasty-recipes-ingredients li, .mv-create-ingredients li, .recipe-ingredients li'
      )
      .toArray()
      .map((element) => normalizeText($(element).text()))
      .filter(Boolean);
    const instructionSteps = pluginRoot
      .find(
        '.wprm-recipe-instruction-text, .tasty-recipes-instructions li, .mv-create-instructions li, .recipe-instructions li'
      )
      .toArray()
      .map((element) => normalizeText($(element).text()))
      .filter(Boolean);
    const name = toOptionalString(pluginRoot.find('.wprm-recipe-name, .tasty-recipes-title').first().text())
      ?? toOptionalString($('h1').first().text());
    if (ingredientLines.length || instructionSteps.length) {
      return { name, servings: null, ingredientLines, instructionSteps, source: 'dom' };
    }
  }

  const scopedRoot = $('article, .entry-content, .post-content, main').first();
  const scope = scopedRoot.length ? load(scopedRoot.html() ?? '') : $;
  const ingredientLines = findListAfterHeading(scope, ['ingredients']);
  const instructionSteps = findListAfterHeading(scope, ['instructions', 'directions', 'method']);
  if (ingredientLines.length || instructionSteps.length) {
    return {
      name: toOptionalString($('h1').first().text()),
      servings: null,
      ingredientLines,
      instructionSteps,
      source: 'heuristic',
    };
  }

  return { ingredientLines: [], instructionSteps: [], source: 'none' };
}

export const list = query({
  args: {
    ...ownerArgs,
    search: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const recipes = await ctx.db
      .query('recipes')
      .withIndex('by_owner', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();
    const search = args.search?.trim().toLowerCase();
    const requiredTags = normalizeTags(args.tags)?.map((tag) => tag.toLowerCase()) ?? [];
    return recipes
      .map((recipe) => toRecipeOutput(recipe))
      .filter((recipe) => {
        if (search) {
          const haystack = [
            recipe.name,
            recipe.instructions,
            recipe.notes ?? '',
            (recipe.tags ?? []).join(' '),
          ]
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        if (!requiredTags.length) return true;
        const recipeTags = (recipe.tags ?? []).map((tag: string) => tag.toLowerCase());
        return requiredTags.every((tag) => recipeTags.includes(tag));
      });
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

    return { recipe: toRecipeOutput(recipe), ingredients };
  },
});

export const importFromUrl = action({
  args: {
    ...ownerArgs,
    url: v.string(),
    recipeId: v.optional(v.id('recipes')),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);

    let content = '';
    try {
      const response = await fetch(args.url, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        },
        redirect: 'follow',
      });
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

    const extracted = extractRecipeFromHtml(content);
    const htmlTitle = extractHtmlTitle(content);
    const deterministicIngredients = extracted.ingredientLines.map((line) => parseIngredientLine(line));
    const hasEnoughDeterministicData =
      deterministicIngredients.length >= 3 && extracted.instructionSteps.length >= 2;

    const jsonLd = extractJsonLdBlocks(content)
      .slice(0, 3)
      .map((block) => truncateText(block, 3000));

    const model = process.env.OPENAI_RECIPE_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
    let parsed: RecipeParseResult | null = null;

    if (hasEnoughDeterministicData) {
      const deterministicPrompt = [
        `URL: ${args.url}`,
        extracted.name ? `Name: ${extracted.name}` : '',
        extracted.servings ? `Servings: ${extracted.servings}` : '',
        canonicalNames.length > 0
          ? `Prefer these existing canonical item names when they match: ${canonicalNames.join(', ')}`
          : '',
        `Ingredients:\n${extracted.ingredientLines.join('\n')}`,
        `Instructions:\n${extracted.instructionSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      parsed = await callOpenAIJson<RecipeParseResult>({
        model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'Canonicalize ingredients to generic singular forms and infer tags/notes when obvious. Keep ingredient quantities and units aligned to provided text.',
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: deterministicPrompt }],
          },
        ],
        schema: {
          name: 'recipe_parse',
          schema: RECIPE_SCHEMA,
          strict: true,
        },
        temperature: 0.1,
        maxOutputTokens: 900,
      });
    } else {
      const fallbackPrompt = [
        `URL: ${args.url}`,
        canonicalNames.length > 0
          ? `Prefer these existing canonical item names when they match: ${canonicalNames.join(', ')}`
          : 'There are no existing canonical items yet.',
        extracted.ingredientLines.length
          ? `Extracted ingredient candidates:\n${extracted.ingredientLines.join('\n')}`
          : '',
        extracted.instructionSteps.length
          ? `Extracted instruction candidates:\n${extracted.instructionSteps
              .map((step, index) => `${index + 1}. ${step}`)
              .join('\n')}`
          : '',
        jsonLd.length > 0 ? `JSON-LD:\n${jsonLd.join('\n\n')}` : '',
        `HTML (truncated):\n${truncateText(content, 4500)}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      parsed = await callOpenAIJson<RecipeParseResult>({
        model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You are a precise recipe parser. Extract recipe name, servings, instructions, notes, tags, and ingredients. Always extract numeric quantity and unit when possible; if unsure set to null. Return canonical ingredient names when possible.',
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: fallbackPrompt }],
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
    }

    const name =
      extracted.name ??
      toOptionalString(parsed?.name ?? null) ??
      htmlTitle ??
      args.url.replace(/^https?:\/\//, '').slice(0, 60);

    const parsedIngredients = parsed?.ingredients ?? [];
    const confidenceBySource =
      extracted.source === 'jsonld' ? 0.95 : extracted.source === 'dom' ? 0.85 : extracted.source === 'heuristic' ? 0.7 : undefined;

    const deterministicMapped = deterministicIngredients.map((ingredient, index) => {
      const aiIngredient = parsedIngredients[index];
      return {
        name: ingredient.name || toOptionalString(aiIngredient?.name ?? null) || 'Unknown ingredient',
        quantity: ingredient.quantity ?? toOptionalNumber(aiIngredient?.quantity ?? null),
        unit: ingredient.unit ?? toOptionalString(aiIngredient?.unit ?? null),
        confidence: confidenceBySource ?? toOptionalNumber(aiIngredient?.confidence ?? null),
        canonicalName:
          toOptionalString(aiIngredient?.canonical_name ?? null) ??
          toOptionalString(aiIngredient?.name ?? null) ??
          ingredient.name,
      };
    });

    const aiOnlyIngredients = parsedIngredients
      .slice(deterministicMapped.length)
      .map((ingredient) => ({
        name: toOptionalString(ingredient.name) ?? 'Unknown ingredient',
        quantity: toOptionalNumber(ingredient.quantity ?? null),
        unit: toOptionalString(ingredient.unit ?? null),
        confidence: toOptionalNumber(ingredient.confidence ?? null),
        canonicalName: toOptionalString(ingredient.canonical_name ?? null),
      }));

    const ingredients = [...deterministicMapped, ...aiOnlyIngredients];
    const instructions =
      extracted.instructionSteps.length > 0
        ? extracted.instructionSteps.join('\n\n')
        : toOptionalString(parsed?.instructions ?? null) ?? '';
    const servings = extracted.servings ?? toOptionalNumber(parsed?.servings ?? null);
    const tags = normalizeTags(extracted.tags ?? parsed?.tags);

    if (args.recipeId) {
      await ctx.runMutation(api.recipes.update, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        recipeId: args.recipeId,
        name,
        instructions,
        servings,
        pricePerServing: toOptionalNumber(parsed?.price_per_serving ?? null),
        notes: toOptionalString(parsed?.notes ?? null),
        sourceUrl: args.url,
        tags,
      });
      await ctx.runMutation(api.recipes.setIngredients, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        recipeId: args.recipeId,
        ingredients: ingredients.map((ingredient) => ({
          name: ingredient.name,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
        })),
      });
      return args.recipeId;
    }

    const recipeId: any = await ctx.runMutation(api.recipes.createParsedInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      name,
      sourceUrl: args.url,
      instructions,
      servings,
      pricePerServing: toOptionalNumber(parsed?.price_per_serving ?? null),
      notes: toOptionalString(parsed?.notes ?? null),
      tags,
      ingredients,
    });
    return recipeId;
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
      name: result.title,
      title: result.title,
      image: result.image,
      sourceUrl: result.sourceUrl ?? result.spoonacularSourceUrl ?? null,
    }));
  },
});

export const createInternal = mutation({
  args: {
    ...ownerArgs,
    name: v.string(),
    sourceUrl: v.optional(v.string()),
    instructions: v.string(),
    servings: v.optional(v.number()),
    pricePerServing: v.optional(v.number()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.id('recipes'),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    const name = toOptionalString(args.name) ?? 'Recipe';
    const instructions = args.instructions ?? '';
    const tags = normalizeTags(args.tags);
    return await ctx.db.insert('recipes', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      // Legacy fields.
      title: name,
      content: instructions,
      // New fields.
      name,
      sourceUrl: args.sourceUrl,
      instructions,
      servings: args.servings,
      pricePerServing: args.pricePerServing,
      notes: args.notes,
      tags,
      searchName: name.toLowerCase(),
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createParsedInternal = mutation({
  args: {
    ...ownerArgs,
    name: v.string(),
    sourceUrl: v.optional(v.string()),
    instructions: v.string(),
    servings: v.optional(v.number()),
    pricePerServing: v.optional(v.number()),
    notes: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
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
    const name = toOptionalString(args.name) ?? 'Recipe';
    const instructions = args.instructions ?? '';
    const tags = normalizeTags(args.tags);

    const recipeId = await ctx.db.insert('recipes', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      title: name,
      sourceUrl: args.sourceUrl,
      content: instructions,
      name,
      instructions,
      servings: args.servings,
      pricePerServing: args.pricePerServing,
      notes: args.notes,
      tags,
      searchName: name.toLowerCase(),
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
    name: v.string(),
    instructions: v.string(),
    servings: v.optional(v.number()),
    pricePerServing: v.optional(v.number()),
    notes: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.ownerId !== owner.ownerId || recipe.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    const name = args.name.trim() || getRecipeName(recipe);
    const instructions = args.instructions.trim() || getRecipeInstructions(recipe);
    const notes = args.notes?.trim() || undefined;
    const servings = args.servings;
    const pricePerServing = args.pricePerServing;
    const sourceUrl = args.sourceUrl?.trim() || undefined;
    const tags = normalizeTags(args.tags);

    await ctx.db.patch(args.recipeId, {
      title: name,
      content: instructions,
      name,
      instructions,
      notes,
      servings,
      pricePerServing,
      sourceUrl,
      tags,
      searchName: name.toLowerCase(),
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

    const normalizedIngredients = normalizeRecipeIngredientsForSave(args.ingredients, {
      requireAmount: true,
    });
    if (normalizedIngredients.blankNameIndexes.length > 0) {
      throw new Error('Each ingredient must include a name.');
    }
    if (normalizedIngredients.missingAmountIndexes.length > 0) {
      throw new Error('Each ingredient must include an amount before saving.');
    }

    for (const ingredient of normalizedIngredients.ingredients) {
      const name = ingredient.name.trim();
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
    sources: { source: 'receipt' | 'walmart' | 'ai' | 'missing'; count: number }[];
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

    const walmartBaseUrl = process.env.WALMART_API_BASE_URL;
    const walmartApiKey = process.env.WALMART_API_KEY;
    const walmartApiKeyHeader = process.env.WALMART_API_KEY_HEADER;
    const walmartHostHeader = process.env.WALMART_API_HOST_HEADER;
    const walmartHostValue = process.env.WALMART_API_HOST_VALUE;
    const walmartQueryParam = process.env.WALMART_QUERY_PARAM;
    const priceUnitRaw =
      process.env.WALMART_PRICE_UNIT ?? process.env.PRICE_LOOKUP_PRICE_UNIT;
    const priceUnit =
      priceUnitRaw === 'cents' || priceUnitRaw === 'dollars' ? priceUnitRaw : undefined;
    const walmartEnabled =
      canLookup &&
      isFeatureEnabled(process.env.WALMART_LOOKUP_ENABLED, false) &&
      Boolean(walmartBaseUrl);

    const pricingInputs: PricingEvidenceInput[] = [];
    const maxLookups = 14;
    let usedLookups = 0;

    for (const ingredient of detail.ingredients) {
      const evidence: PricingEvidenceInput['evidence'] = {};

      if (ingredient.normalizedItemId) {
        const latest = await ctx.runQuery(api.prices.getLatestPurchasePrice, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          canonicalItemId: ingredient.normalizedItemId,
        });
        if (latest?.price !== undefined && latest?.price !== null) {
          evidence.receiptUnitPrice = latest.price;
        } else {
          const fallback = await ctx.runQuery(api.prices.getForItem, {
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            canonicalItemId: ingredient.normalizedItemId,
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
        canLookup &&
        walmartEnabled &&
        walmartBaseUrl &&
        usedLookups < maxLookups
      ) {
        const lookupQueries = buildIngredientLookupQueries(ingredient.name);
        for (const lookupQuery of lookupQueries) {
          if (usedLookups >= maxLookups) break;
          usedLookups += 1;

          try {
            const walmart = await lookupWalmartPrice(lookupQuery, {
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
            }
          } catch {
            // Ignore Walmart lookup failures.
          }

          if (evidence.receiptUnitPrice !== undefined || evidence.walmartUnitPrice !== undefined) {
            break;
          }
        }
      }

      pricingInputs.push({
        itemName: ingredient.name,
        canonicalName: ingredient.name,
        quantity: ingredient.quantity ?? undefined,
        unit: ingredient.unit ?? undefined,
        evidence,
      });
    }

    const aiPricingEnabled =
      canLookup &&
      isFeatureEnabled(process.env.AI_RECIPE_PRICE_V2_ENABLED, true) &&
      Boolean(process.env.OPENAI_API_KEY);
    const aiModel =
      process.env.OPENAI_RECIPE_PRICE_MODEL ??
      process.env.OPENAI_PRICE_MODEL ??
      process.env.OPENAI_MODEL ??
      'gpt-4o-mini';

    const pricing = aiPricingEnabled
      ? await estimatePricingWithAi({
          model: aiModel,
          contextLabel: `recipe_${args.recipeId}`,
          inputs: pricingInputs,
        })
      : finalizePricingFromEvidence(pricingInputs);

    for (let index = 0; index < pricing.items.length; index += 1) {
      const estimate = pricing.items[index];
      const ingredient = detail.ingredients[index];
      if (!ingredient?.normalizedItemId || estimate.unitPrice === undefined) continue;
      if (estimate.source === 'missing' || estimate.source === 'receipt') continue;

      const persistedSource =
        estimate.source === 'ai' ? 'ai' : estimate.source === 'walmart' ? 'walmart' : 'walmart';

      await ctx.runMutation(api.prices.recordPriceEstimate, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        canonicalItemId: ingredient.normalizedItemId,
        price: estimate.unitPrice,
        currency: pricing.currency ?? 'USD',
        source: persistedSource,
      });
    }

    let receiptCount = 0;
    let onlineCount = 0;
    let missingCount = 0;
    let walmartCount = 0;
    let aiCount = 0;
    for (const item of pricing.items) {
      if (item.source === 'receipt') {
        receiptCount += 1;
      } else if (item.source === 'walmart' || item.source === 'online' || item.source === 'winco') {
        walmartCount += 1;
        onlineCount += 1;
      } else if (item.source === 'ai') {
        aiCount += 1;
        onlineCount += 1;
      } else if (item.source === 'missing') {
        missingCount += 1;
      }
    }

    const totalCost = pricing.totalEstimatedCost;
    const servings = detail.recipe.servings ?? 1;
    const costPerServing = servings > 0 ? totalCost / servings : totalCost;
    const ingredientCount = detail.ingredients.length;
    const confidenceRaw =
      ingredientCount > 0
        ? (receiptCount + walmartCount * 0.75 + aiCount * 0.35) / ingredientCount
        : 0;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));

    const costSources: string[] = [];
    if (receiptCount > 0) costSources.push('receipt');
    if (walmartCount > 0) costSources.push('walmart');
    if (aiCount > 0) costSources.push('ai');

    await ctx.runMutation(api.recipes.updateCostEstimate, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      recipeId: args.recipeId,
      pricePerServing: roundCurrency(costPerServing),
      costConfidence: confidence,
      costSources,
    });

    return {
      totalCost: roundCurrency(totalCost),
      costPerServing: roundCurrency(costPerServing),
      currency: pricing.currency ?? 'USD',
      receiptCount,
      onlineCount,
      missingCount,
      confidence,
      sources: [
        { source: 'receipt', count: receiptCount },
        { source: 'walmart', count: walmartCount },
        { source: 'ai', count: aiCount },
        { source: 'missing', count: missingCount },
      ],
    };
  },
});

export const updateCostEstimate = mutation({
  args: {
    ...ownerArgs,
    recipeId: v.id('recipes'),
    pricePerServing: v.number(),
    costConfidence: v.number(),
    costSources: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const recipe = await ctx.db.get(args.recipeId);
    if (!recipe || recipe.ownerId !== owner.ownerId || recipe.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }

    await ctx.db.patch(recipe._id, {
      pricePerServing: args.pricePerServing,
      costConfidence: args.costConfidence,
      costSources: args.costSources,
      updatedAt: Date.now(),
    });
  },
});
