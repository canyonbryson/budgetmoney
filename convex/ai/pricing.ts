import { normalizeQuantity } from '../lib/normalize';
import { callOpenAIJson } from '../openai';

export type PriceSource = 'receipt' | 'winco' | 'online' | 'ai' | 'missing';

export type ItemPriceEvidence = {
  receiptUnitPrice?: number;
  wincoUnitPrice?: number;
  onlineUnitPrice?: number;
  aiUnitPrice?: number;
};

export type PricingEvidenceInput = {
  itemName: string;
  canonicalName?: string;
  quantity?: number;
  unit?: string;
  evidence: ItemPriceEvidence;
};

export type PricingEstimateItem = {
  itemName: string;
  canonicalName?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  estimatedCost?: number;
  source: PriceSource;
  confidence?: number;
  rationale?: string;
};

export type PricingEstimateResult = {
  currency: string;
  totalEstimatedCost: number;
  items: PricingEstimateItem[];
};

type AiPriceEstimateResponse = {
  currency?: string;
  shopping_list_total: number;
  items: Array<{
    canonical_name: string;
    unit_estimate: number;
    line_estimate: number;
    source: string;
    confidence: number;
    rationale?: string | null;
  }>;
};

export const PRICE_ESTIMATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'shopping_list_total', 'currency'],
  properties: {
    currency: { type: 'string' },
    shopping_list_total: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['canonical_name', 'line_estimate', 'unit_estimate', 'source', 'confidence'],
        properties: {
          canonical_name: { type: 'string' },
          unit_estimate: { type: 'number' },
          line_estimate: { type: 'number' },
          source: { type: 'string' },
          confidence: { type: 'number' },
          rationale: { type: ['string', 'null'] },
        },
      },
    },
  },
} as const;

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeName(value?: string) {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSource(source?: string): PriceSource {
  const normalized = (source ?? '').trim().toLowerCase();
  if (normalized === 'receipt') return 'receipt';
  if (normalized === 'winco') return 'winco';
  if (normalized === 'online') return 'online';
  if (normalized === 'ai') return 'ai';
  return 'missing';
}

export function chooseBestPriceEvidence(evidence: ItemPriceEvidence): {
  unitPrice?: number;
  source: PriceSource;
} {
  if (typeof evidence.receiptUnitPrice === 'number' && Number.isFinite(evidence.receiptUnitPrice)) {
    return { unitPrice: evidence.receiptUnitPrice, source: 'receipt' };
  }
  if (typeof evidence.wincoUnitPrice === 'number' && Number.isFinite(evidence.wincoUnitPrice)) {
    return { unitPrice: evidence.wincoUnitPrice, source: 'winco' };
  }
  if (typeof evidence.onlineUnitPrice === 'number' && Number.isFinite(evidence.onlineUnitPrice)) {
    return { unitPrice: evidence.onlineUnitPrice, source: 'online' };
  }
  if (typeof evidence.aiUnitPrice === 'number' && Number.isFinite(evidence.aiUnitPrice)) {
    return { unitPrice: evidence.aiUnitPrice, source: 'ai' };
  }
  return { source: 'missing' };
}

export function estimateLineCostFromUnitPrice(
  unitPrice: number,
  quantity?: number,
  unit?: string
) {
  if (!Number.isFinite(unitPrice)) return 0;

  const normalized = normalizeQuantity(quantity, unit);
  if (normalized.quantity === undefined) {
    return roundCurrency(unitPrice);
  }

  if (normalized.kind === 'count') {
    return roundCurrency(unitPrice * Math.max(1, normalized.quantity));
  }

  if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= 24) {
    return roundCurrency(unitPrice * quantity);
  }

  if (normalized.kind === 'volume' || normalized.kind === 'mass') {
    return roundCurrency(unitPrice * Math.max(1, normalized.quantity / 500));
  }

  return roundCurrency(unitPrice * Math.max(1, normalized.quantity));
}

export function finalizePricingFromEvidence(inputs: PricingEvidenceInput[]): PricingEstimateResult {
  const items: PricingEstimateItem[] = inputs.map((input) => {
    const selected = chooseBestPriceEvidence(input.evidence);

    if (selected.unitPrice === undefined) {
      return {
        itemName: input.itemName,
        canonicalName: input.canonicalName,
        quantity: input.quantity,
        unit: input.unit,
        source: 'missing',
      };
    }

    return {
      itemName: input.itemName,
      canonicalName: input.canonicalName,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: selected.unitPrice,
      estimatedCost: estimateLineCostFromUnitPrice(selected.unitPrice, input.quantity, input.unit),
      source: selected.source,
    };
  });

  const totalEstimatedCost = roundCurrency(
    items.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0)
  );

  return {
    currency: 'USD',
    items,
    totalEstimatedCost,
  };
}

function buildPricePrompts(contextLabel: string, fallback: PricingEstimateResult) {
  const systemPrompt = [
    'You estimate grocery prices using provided evidence.',
    'Use receipt evidence first, then store-specific web prices, then fallback online prices.',
    'Do not invent outlier prices. Keep outputs realistic and consistent with provided evidence.',
    'If uncertain, lower confidence and explain briefly in rationale.',
    'Return strictly valid JSON that matches the schema.',
  ].join(' ');

  const userPayload = {
    context: contextLabel,
    items: fallback.items.map((item) => ({
      canonical_name: item.canonicalName ?? item.itemName,
      display_name: item.itemName,
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
      fallback_unit_price: item.unitPrice ?? null,
      fallback_line_estimate: item.estimatedCost ?? null,
      fallback_source: item.source,
    })),
  };

  return {
    systemPrompt,
    userPrompt: JSON.stringify(userPayload),
  };
}

export async function estimatePricingWithAi(args: {
  model: string;
  contextLabel: string;
  inputs: PricingEvidenceInput[];
}) {
  const fallback = finalizePricingFromEvidence(args.inputs);
  if (!args.inputs.length) return fallback;

  const { systemPrompt, userPrompt } = buildPricePrompts(args.contextLabel, fallback);

  try {
    const parsed = await callOpenAIJson<AiPriceEstimateResponse>({
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
        name: 'price_estimate_v1',
        schema: PRICE_ESTIMATE_SCHEMA,
        strict: true,
      },
      temperature: 0.1,
      maxOutputTokens: 2000,
    });

    const aiIndex = new Map(
      (parsed.items ?? []).map((item) => [normalizeName(item.canonical_name), item])
    );

    const items = fallback.items.map((item) => {
      const key = normalizeName(item.canonicalName ?? item.itemName);
      const aiItem = key ? aiIndex.get(key) : undefined;
      if (!aiItem) return item;

      const lineEstimate =
        typeof aiItem.line_estimate === 'number' && Number.isFinite(aiItem.line_estimate)
          ? roundCurrency(aiItem.line_estimate)
          : item.estimatedCost;
      const unitEstimate =
        typeof aiItem.unit_estimate === 'number' && Number.isFinite(aiItem.unit_estimate)
          ? roundCurrency(aiItem.unit_estimate)
          : item.unitPrice;

      return {
        ...item,
        source: normalizeSource(aiItem.source),
        confidence:
          typeof aiItem.confidence === 'number' && Number.isFinite(aiItem.confidence)
            ? Math.max(0, Math.min(1, aiItem.confidence))
            : item.confidence,
        rationale:
          typeof aiItem.rationale === 'string' && aiItem.rationale.trim().length
            ? aiItem.rationale.trim()
            : item.rationale,
        unitPrice: unitEstimate,
        estimatedCost: lineEstimate,
      };
    });

    const totalEstimatedCost = roundCurrency(
      items.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0)
    );

    return {
      currency: typeof parsed.currency === 'string' && parsed.currency.trim().length
        ? parsed.currency.trim().toUpperCase()
        : fallback.currency,
      items,
      totalEstimatedCost,
    };
  } catch {
    return fallback;
  }
}
