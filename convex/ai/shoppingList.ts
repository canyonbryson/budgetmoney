import { roundQuantity } from '../lib/normalize';
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

function normalizeName(value?: string | null) {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    .map((item) => ({
      itemName: item.itemName?.trim() ?? '',
      quantity: toOptionalNumber(item.quantity),
      unit: toOptionalString(item.unit),
    }))
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
    const itemName =
      toOptionalString(aiItem.display_name) ??
      toOptionalString(aiItem.canonical_name) ??
      undefined;
    if (!itemName) continue;

    const canonical = normalizeName(aiItem.canonical_name) || normalizeName(itemName);
    const unit = toOptionalString(aiItem.unit);
    const key = `${canonical}:${unit ?? ''}`;

    const current = merged.get(key) ?? {
      itemName,
      quantity: 0,
      hasUnknownQuantity: false,
      unit,
    };

    const quantity = toOptionalNumber(aiItem.quantity);
    if (quantity === undefined) {
      current.hasUnknownQuantity = true;
    } else {
      current.quantity = roundQuantity(current.quantity + quantity);
    }

    if (!current.itemName) current.itemName = itemName;
    if (!current.unit && unit) current.unit = unit;

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
    'Combine duplicate ingredients across meals into one list.',
    'Use pantry context to omit ingredients that are fully covered by pantry inventory.',
    'Keep quantities realistic and avoid inventing ingredients.',
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
