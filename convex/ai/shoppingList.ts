import { normalizeQuantity, roundQuantity } from '../lib/normalize';
import { callOpenAIJson } from '../openai';

export type ShoppingListMergeItemDraft = {
  itemName: string;
  quantity?: number;
  unit?: string;
};

export type ShoppingListMealIngredient = {
  name: string;
  quantity?: number;
  unit?: string;
};

export type ShoppingListMealContext = {
  day?: string;
  slot?: string;
  title: string;
  ingredients: ShoppingListMealIngredient[];
};

export type ShoppingListPantryContext = {
  name: string;
  quantity?: number;
  unit?: string;
};

export type ShoppingListMergeContext = {
  weekStart: string;
  meals: ShoppingListMealContext[];
  draftItems: ShoppingListMergeItemDraft[];
  canonicalNames: string[];
  pantryItems: ShoppingListPantryContext[];
};

type ShoppingListMergeModelItem = {
  canonical_name: string;
  display_name: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  source_meals: string[];
  assumptions?: string[];
};

type ShoppingListMergeResponse = {
  items: ShoppingListMergeModelItem[];
};

export const SHOPPING_LIST_MERGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'canonical_name',
          'display_name',
          'quantity',
          'unit',
          'confidence',
          'source_meals',
        ],
        properties: {
          canonical_name: { type: 'string' },
          display_name: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          unit: { type: ['string', 'null'] },
          confidence: { type: 'number' },
          source_meals: {
            type: 'array',
            items: { type: 'string' },
          },
          assumptions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const LEADING_PACK_WORDS = new Set(['can', 'cans', 'package', 'packages', 'pkg', 'pkgs', 'rib', 'ribs']);
const PREP_WORDS = new Set([
  'about',
  'finely',
  'roughly',
  'thinly',
  'thickly',
  'small',
  'medium',
  'large',
  'fresh',
  'freshly',
  'ground',
  'crushed',
  'chopped',
  'minced',
  'diced',
  'shredded',
  'grated',
  'peeled',
  'seeded',
  'cubed',
  'sliced',
  'boneless',
  'skinless',
  'cooked',
  'uncooked',
  'juice',
  'with',
  'the',
  'to',
  'taste',
]);
const STYLE_PREFIX_WORDS = new Set(['diced', 'crushed']);

function normalizeName(value?: string | null) {
  if (!value) return '';
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => singularize(token));
  return tokens
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularize(token: string) {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2);
  if (/(ses|xes|zes|ches|shes)$/.test(token) && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function cleanupIngredientName(raw: string) {
  const withoutMalformedParens = raw.replace(/\(\s*,/g, '(');
  const withoutParentheticals = withoutMalformedParens.replace(/\([^)]*\)/g, ' ');
  const withoutFractions = withoutParentheticals
    .replace(/\b\d+\s*\/\s*\d+\b/g, ' ')
    .replace(/\b\d+(\.\d+)?\b/g, ' ');
  const firstToken = withoutFractions
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .trim()
    .split(/\s+/)[0];
  const keepFirstStyleWord = firstToken ? STYLE_PREFIX_WORDS.has(firstToken) : false;

  const tokens = withoutFractions
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token, index) => {
      if (!PREP_WORDS.has(token)) return true;
      return index === 0 && keepFirstStyleWord;
    });

  while (tokens.length > 1 && LEADING_PACK_WORDS.has(tokens[0])) {
    tokens.shift();
  }

  const normalizedTokens = tokens.length === 1 ? [singularize(tokens[0])] : tokens;
  return normalizedTokens.join(' ').trim();
}

function normalizeUnitKindKey(quantity?: number | null, unit?: string) {
  const cleanedUnit = toOptionalString(unit);
  const normalized = normalizeQuantity(quantity ?? undefined, unit);
  if (normalized.kind === 'unknown') {
    return {
      key: `unknown:${(cleanedUnit ?? '').toLowerCase()}`,
      unit: cleanedUnit,
    };
  }
  return {
    key: normalized.kind,
    unit: cleanedUnit ?? normalized.unit,
  };
}

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function toOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeMergedShoppingListItems(
  aiItems: ShoppingListMergeModelItem[] | undefined,
  fallbackDraft: ShoppingListMergeItemDraft[]
): ShoppingListMergeItemDraft[] {
  const safeFallback = fallbackDraft
    .map((item) => {
      const cleanedName = cleanupIngredientName(item.itemName ?? '');
      return {
        itemName: cleanedName || item.itemName?.trim() || '',
        quantity: toOptionalNumber(item.quantity),
        unit: toOptionalString(item.unit),
      };
    })
    .filter((item) => item.itemName.length > 0);

  if (!aiItems?.length) {
    return safeFallback;
  }

  type Aggregated = {
    itemName: string;
    quantity: number;
    hasUnknownQuantity: boolean;
    unit?: string;
  };

  const merged = new Map<string, Aggregated>();

  for (const aiItem of aiItems) {
    const canonicalName = cleanupIngredientName(
      toOptionalString(aiItem.canonical_name) ?? toOptionalString(aiItem.display_name) ?? ''
    );
    const displayName = cleanupIngredientName(
      toOptionalString(aiItem.display_name) ?? toOptionalString(aiItem.canonical_name) ?? ''
    );

    const itemName = canonicalName || displayName;
    if (!itemName) continue;

    const canonical = normalizeName(canonicalName || itemName);
    const unitKind = normalizeUnitKindKey(aiItem.quantity, toOptionalString(aiItem.unit));
    const key = `${canonical}:${unitKind.key}`;

    const current = merged.get(key) ?? {
      itemName,
      quantity: 0,
      hasUnknownQuantity: false,
      unit: unitKind.unit,
    };

    const quantity = toOptionalNumber(aiItem.quantity);
    if (quantity === undefined) {
      current.hasUnknownQuantity = true;
    } else {
      current.quantity = roundQuantity(current.quantity + quantity);
    }

    if (!current.itemName) current.itemName = itemName;
    if (!current.unit && unitKind.unit) current.unit = unitKind.unit;

    merged.set(key, current);
  }

  const result = Array.from(merged.values())
    .filter((item) => item.itemName.length > 0)
    .map((item) => ({
      itemName: item.itemName,
      quantity: item.hasUnknownQuantity ? undefined : item.quantity,
      unit: item.unit,
    }));
  return result.length ? result : safeFallback;
}

export function buildShoppingListMergePrompts(context: ShoppingListMergeContext) {
  const systemPrompt = [
    'You are a precise grocery shopping list optimizer.',
    'Canonicalize ingredient names into clean grocery nouns suitable for a shopping list.',
    'Strip preparation and note text such as finely diced, chopped, with the juice, and parenthetical comments.',
    'Example bad to good: "cans diced tomatoes (, with the juice)" => "diced tomatoes".',
    'Example bad to good: "carrots (, finely diced (about 1 cup))" => "carrot".',
    'Combine duplicate and near-duplicate ingredients across meals into one list.',
    'If quantity is unknown, set it to null.',
    'Return strictly valid JSON that matches the schema.',
  ].join(' ');

  const userPayload = {
    week_start: context.weekStart,
    meals: context.meals,
    deterministic_draft_items: context.draftItems,
    pantry_items: context.pantryItems,
    canonical_item_names: context.canonicalNames.slice(0, 300),
  };

  const userPrompt = JSON.stringify(userPayload);

  return { systemPrompt, userPrompt };
}

export async function mergeShoppingListWithAi(args: {
  model: string;
  context: ShoppingListMergeContext;
  fallbackDraft: ShoppingListMergeItemDraft[];
}) {
  const { systemPrompt, userPrompt } = buildShoppingListMergePrompts(args.context);

  try {
    const parsed = await callOpenAIJson<ShoppingListMergeResponse>({
      model: args.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: userPrompt }],
        },
      ],
      schema: {
        name: 'shopping_list_merge_v1',
        schema: SHOPPING_LIST_MERGE_SCHEMA,
        strict: true,
      },
      temperature: 0.1,
      maxOutputTokens: 2000,
    });

    return normalizeMergedShoppingListItems(parsed.items, args.fallbackDraft);
  } catch {
    return normalizeMergedShoppingListItems([], args.fallbackDraft);
  }
}
