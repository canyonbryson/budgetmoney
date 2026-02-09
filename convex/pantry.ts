import { v } from 'convex/values';
import { action, internalMutation, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { Doc } from './_generated/dataModel';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';
import { callOpenAIJson } from './openai';
import { normalizeItemName, normalizeQuantity, roundQuantity } from './lib/normalize';

export const list = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('pantryItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
  },
});

export const add = mutation({
  args: {
    ...ownerArgs,
    name: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    await ctx.db.insert('pantryItems', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      name: args.name,
      quantity: args.quantity,
      unit: args.unit,
      createdAt: now,
      updatedAt: now,
    });
  },
});

type PantryParseItem = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  confidence?: number | null;
};

type PantryParseResult = {
  items: PantryParseItem[];
  notes?: string | null;
  confidence?: number | null;
};

const PANTRY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    notes: { type: ['string', 'null'] },
    confidence: { type: ['number', 'null'] },
    items: {
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
        },
      },
    },
  },
} as const;

function toOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const generateUploadUrl = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    await resolveOwner(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const importFromPhoto = action({
  args: {
    ...ownerArgs,
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    const imageUrl = await ctx.storage.getUrl(args.storageId as any);
    if (!imageUrl) throw new Error('Pantry image missing');

    const systemPrompt = [
      'You are a careful pantry inventory parser.',
      'Identify pantry items visible in the photo.',
      'Return a list of items with quantity and unit when possible.',
      'If you are unsure about quantity or unit, set them to null.',
      'Use generic, unbranded, singular item names.',
    ].join(' ');

    const userPrompt = 'Parse this pantry photo and return JSON that matches the schema.';

    const model = process.env.OPENAI_PANTRY_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const parsed = await callOpenAIJson<PantryParseResult>({
      model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: systemPrompt }],
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: userPrompt },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      schema: {
        name: 'pantry_parse',
        schema: PANTRY_SCHEMA,
        strict: true,
      },
      temperature: 0.2,
      maxOutputTokens: 1200,
    });

    const items = (parsed.items ?? [])
      .map((rawItem) => ({
        name: toOptionalString(rawItem.name) ?? '',
        quantity: toOptionalNumber(rawItem.quantity ?? null),
        unit: toOptionalString(rawItem.unit ?? null),
      }))
      .filter((item) => item.name.length > 0);

    await ctx.runMutation(internal.pantry.applyParsedItemsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      items,
    });

    return { status: 'imported' };
  },
});

export const applyParsedItemsInternal = internalMutation({
  args: {
    ...ownerArgs,
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        unit: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const existing: Doc<'pantryItems'>[] = await ctx.db
      .query('pantryItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();

    const now = Date.now();

    for (const rawItem of args.items) {
      const name = rawItem.name;
      if (!name) continue;

      const normalizedName = normalizeItemName(name);
      const normalized = normalizeQuantity(rawItem.quantity, rawItem.unit);

      const candidates = existing.filter(
        (item) => normalizeItemName(item.name) === normalizedName
      );

      let target = candidates[0];
      if (normalized.kind !== 'unknown') {
        target =
          candidates.find((item) => {
            const existingNormalized = normalizeQuantity(item.quantity, item.unit);
            return existingNormalized.kind === normalized.kind;
          }) ?? target;
      }

      if (target) {
        const existingNormalized = normalizeQuantity(target.quantity, target.unit);
        if (
          normalized.quantity !== undefined &&
          existingNormalized.quantity !== undefined &&
          normalized.kind === existingNormalized.kind &&
          normalized.kind !== 'unknown'
        ) {
          await ctx.db.patch(target._id, {
            quantity: roundQuantity(existingNormalized.quantity + normalized.quantity),
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
        continue;
      }

      await ctx.db.insert('pantryItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        name,
        quantity: normalized.quantity,
        unit: normalized.unit,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { status: 'imported' };
  },
});
