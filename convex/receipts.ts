import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { api } from './_generated/api';
import { Doc, Id } from './_generated/dataModel';
import { ownerArgs, resolveOwner, requireSignedIn, type Owner } from './ownership';
import { callOpenAIJson } from './openai';

type ReceiptParseItem = {
  name: string;
  quantity?: number | null;
  price?: number | null;
  line_total?: number | null;
  confidence?: number | null;
  canonical_name?: string | null;
};

type ReceiptParseResult = {
  merchant_name?: string | null;
  receipt_date?: string | null;
  total_amount?: number | null;
  currency?: string | null;
  confidence?: number | null;
  items: ReceiptParseItem[];
  notes?: string | null;
};

const RECEIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    merchant_name: { type: ['string', 'null'] },
    receipt_date: { type: ['string', 'null'] },
    total_amount: { type: ['number', 'null'] },
    currency: { type: ['string', 'null'] },
    confidence: { type: ['number', 'null'] },
    notes: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          price: { type: ['number', 'null'] },
          line_total: { type: ['number', 'null'] },
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

function computeLineTotal(
  quantity?: number,
  price?: number,
  lineTotal?: number
) {
  if (typeof lineTotal === 'number' && Number.isFinite(lineTotal)) {
    return lineTotal;
  }
  if (
    typeof quantity === 'number' &&
    Number.isFinite(quantity) &&
    typeof price === 'number' &&
    Number.isFinite(price)
  ) {
    return quantity * price;
  }
  if (typeof price === 'number' && Number.isFinite(price)) {
    return price;
  }
  return undefined;
}

function normalizeMerchantName(name?: string) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|co|corp|company|store|market|supercenter)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diffDays(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  const diffMs = Math.abs(da.getTime() - db.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function parseReceiptDateToTimestamp(dateString?: string) {
  if (!dateString) return Date.now();
  const parsed = Date.parse(dateString);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function computeMismatch(
  receiptTotal?: number,
  transactionAmount?: number
) {
  if (typeof receiptTotal !== 'number' || typeof transactionAmount !== 'number') {
    return null;
  }
  const receiptAbs = Math.abs(receiptTotal);
  const txAbs = Math.abs(transactionAmount);
  if (!Number.isFinite(receiptAbs) || receiptAbs <= 0 || !Number.isFinite(txAbs)) {
    return null;
  }
  const diff = Math.abs(txAbs - receiptAbs);
  const diffPct = diff / receiptAbs;
  return { diff, diffPct, withinTolerance: diffPct <= 0.05 };
}

export function computeAmountMatchScore(
  transactionAmount: number,
  receiptAmount?: number
) {
  if (typeof receiptAmount !== 'number') {
    return { amountDiff: null, amountPct: null, amountScore: 0.4 };
  }

  const amountDiff = Math.abs(transactionAmount - receiptAmount);
  const amountPct = receiptAmount > 0 ? amountDiff / receiptAmount : null;
  const amountScore =
    amountDiff <= 0.5 ? 1 : amountDiff <= 1 ? 0.8 : amountDiff <= 2 ? 0.4 : 0;

  return { amountDiff, amountPct, amountScore };
}

function addDays(dateString: string, days: number) {
  const base = new Date(dateString);
  if (Number.isNaN(base.getTime())) return undefined;
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
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

async function loadGroceryCategoryIndex(
  ctx: any,
  owner: Owner
) {
  const categories = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(
        q.eq(q.field('ownerType'), owner.ownerType),
        q.eq(q.field('ownerId'), owner.ownerId)
      )
    )
    .collect();

  const groceriesParent =
    categories.find(
      (cat: any) => !cat.parentId && cat.name?.toLowerCase() === 'groceries'
    ) ??
    categories.find((cat: any) => cat.name?.toLowerCase() === 'groceries');

  const groceriesParentId = groceriesParent?._id;
  const grocerySubcategoryIds = new Set<Id<'categories'>>();

  if (groceriesParentId) {
    for (const cat of categories) {
      if (cat.parentId === groceriesParentId) {
        grocerySubcategoryIds.add(cat._id);
      }
    }
  }

  const categoryById = new Map(categories.map((cat: any) => [cat._id, cat]));

  return { groceriesParentId, grocerySubcategoryIds, categoryById };
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

export const list = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('receipts')
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
    receiptId: v.id('receipts'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) return null;

    const imageUrl = await ctx.storage.getUrl(receipt.storageId as any);

    const lineItems = await ctx.db
      .query('receiptLineItems')
      .withIndex('by_receipt', (q) => q.eq('receiptId', receipt._id))
      .collect();

    const canonicalIds = Array.from(
      new Set(
        lineItems
          .map((item) => item.normalizedItemId)
          .filter((id): id is Id<'canonicalItems'> => Boolean(id))
      )
    );

    const canonicalMap = new Map<Id<'canonicalItems'>, string>();
    for (const id of canonicalIds) {
      const item = await ctx.db.get(id);
      if (item && item.ownerId === owner.ownerId && item.ownerType === owner.ownerType) {
        canonicalMap.set(item._id, item.name);
      }
    }

    const linkedTransaction = receipt.linkedTransactionId
      ? await ctx.db.get(receipt.linkedTransactionId)
      : null;

    return {
      receipt,
      imageUrl,
      linkedTransaction: linkedTransaction
        ? {
            _id: linkedTransaction._id,
            name: linkedTransaction.name,
            date: linkedTransaction.date,
            amount: linkedTransaction.amount,
            currency: linkedTransaction.currency,
          }
        : null,
      lineItems: lineItems.map((item) => ({
        ...item,
        canonicalName: item.normalizedItemId
          ? canonicalMap.get(item.normalizedItemId) ?? null
          : null,
      })),
    };
  },
});

export const listNeedsReview = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const items = await ctx.db
      .query('receiptLineItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('needsReview'), true)
        )
      )
      .collect();

    const results = [];
    for (const item of items) {
      const receipt = await ctx.db.get(item.receiptId);
      if (!receipt || receipt.ownerId !== owner.ownerId) continue;
      results.push({
        ...item,
        receipt: {
          _id: receipt._id,
          merchantName: receipt.merchantName,
          receiptDate: receipt.receiptDate,
          currency: receipt.currency,
        },
      });
    }
    return results;
  },
});

export const listReceiptsNeedingReview = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipts = await ctx.db
      .query('receipts')
      .withIndex('by_owner_review', (q) =>
        q
          .eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('needsReview', true)
      )
      .collect();

    if (!receipts.length) return [];

    const reviewItems = await ctx.db
      .query('receiptLineItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('needsReview'), true)
        )
      )
      .collect();

    const counts = new Map<string, number>();
    for (const item of reviewItems) {
      const key = String(item.receiptId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return receipts.map((rec) => ({
      _id: rec._id,
      merchantName: rec.merchantName,
      receiptDate: rec.receiptDate,
      totalAmount: rec.totalAmount,
      currency: rec.currency,
      linkedTransactionId: rec.linkedTransactionId,
      linkStatus: rec.linkStatus,
      needsReview: rec.needsReview,
      reviewItemCount: counts.get(String(rec._id)) ?? 0,
    }));
  },
});

export const listCandidateTransactions = query({
  args: {
    ...ownerArgs,
    receiptId: v.id('receipts'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) return [];

    const amount = typeof receipt.totalAmount === 'number' ? Math.abs(receipt.totalAmount) : null;
    const startDate = receipt.receiptDate ? addDays(receipt.receiptDate, -2) : undefined;
    const endDate = receipt.receiptDate ? addDays(receipt.receiptDate, 2) : undefined;

    let query = ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      );

    if (startDate) {
      query = query.filter((q) => q.gte(q.field('date'), startDate));
    }
    if (endDate) {
      query = query.filter((q) => q.lte(q.field('date'), endDate));
    }

    const items = await query.order('desc').take(50);
    const scored = items.map((tx) => {
      const txAmount = Math.abs(tx.amount);
      const amountDiff = amount !== null ? Math.abs(txAmount - amount) : 0;
      return { tx, amountDiff };
    });

    const tolerance =
      amount !== null && amount > 0 ? amount * 0.05 : null;
    const filtered =
      amount !== null && tolerance !== null
        ? scored.filter((item) => item.amountDiff <= tolerance)
        : scored;

    const candidates = (filtered.length ? filtered : scored)
      .sort((a, b) => a.amountDiff - b.amountDiff)
      .slice(0, args.limit ?? 8)
      .map((item) => item.tx);

    return candidates;
  },
});

export const generateUploadUrl = mutation({
  args: ownerArgs,
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    await resolveOwner(ctx, args);
    return await ctx.storage.generateUploadUrl();
  },
});

export const createFromUpload = mutation({
  args: {
    ...ownerArgs,
    storageId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    return await ctx.db.insert('receipts', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      storageId: args.storageId,
      linkStatus: 'unlinked',
      needsReview: false,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const parse = action({
  args: {
    ...ownerArgs,
    receiptId: v.id('receipts'),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.runQuery(api.receipts.getByIdInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      receiptId: args.receiptId,
    });
    if (!receipt) throw new Error('Not found');

    const imageUrl = await ctx.storage.getUrl(receipt.storageId as any);
    if (!imageUrl) throw new Error('Receipt image missing');

    const canonicalItems = await ctx.runQuery(api.receipts.listCanonicalItemsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    });

    const canonicalNames = canonicalItems
      .map((item: any) => item.name)
      .filter((name: string) => name)
      .slice(0, 200);

    const systemPrompt = [
      'You are a careful receipt parser.',
      'Extract merchant name, receipt date, total amount, currency, and line items.',
      'Use YYYY-MM-DD for the receipt_date when possible.',
      'For each line item, include a canonical item name (generic, unbranded, singular).',
      'If you are unsure, set fields to null and lower the confidence.',
      'Use ISO 4217 currency codes when possible.',
    ].join(' ');

    const userPrompt = [
      'Parse this receipt image and return JSON that matches the provided schema.',
      canonicalNames.length > 0
        ? `Prefer these existing canonical item names when they match: ${canonicalNames.join(', ')}`
        : 'There are no existing canonical items yet.',
    ].join(' ');

    const model = process.env.OPENAI_RECEIPT_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const parsed = await callOpenAIJson<ReceiptParseResult>({
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
        name: 'receipt_parse',
        schema: RECEIPT_SCHEMA,
        strict: true,
      },
      temperature: 0.1,
      maxOutputTokens: 1200,
    });

    const items = (parsed.items ?? []).map((item) => {
      const name = toOptionalString(item.name) ?? 'Unknown item';
      const quantity = toOptionalNumber(item.quantity ?? null);
      const rawLineTotal = toOptionalNumber(item.line_total ?? null);
      const directPrice = toOptionalNumber(item.price ?? null);
      const price =
        directPrice ?? (quantity && rawLineTotal ? rawLineTotal / quantity : rawLineTotal);
      const lineTotal = computeLineTotal(quantity, price, rawLineTotal);
      const confidence = toOptionalNumber(item.confidence ?? null);
      const canonicalName = toOptionalString(item.canonical_name ?? null);
      const needsReview = !price || (confidence ?? 0) < 0.5;
      return {
        name,
        quantity,
        price,
        lineTotal,
        confidence,
        needsReview,
        canonicalName,
      };
    });

    const merchantName =
      toOptionalString(parsed.merchant_name ?? null) ?? receipt.merchantName ?? undefined;
    const currency = toOptionalString(parsed.currency ?? null) ?? receipt.currency ?? undefined;
    const totalAmount =
      toOptionalNumber(parsed.total_amount ?? null) ??
      (typeof receipt.totalAmount === 'number' ? receipt.totalAmount : undefined);
    const receiptDate =
      toOptionalString(parsed.receipt_date ?? null) ?? receipt.receiptDate ?? undefined;

    await ctx.runMutation(api.receipts.applyParsedInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      receiptId: args.receiptId,
      merchantName,
      totalAmount,
      currency,
      receiptDate,
      confidence: toOptionalNumber(parsed.confidence ?? null),
      items,
    });

    if (receipt.linkedTransactionId) {
      await ctx.runMutation(api.transactions.applyReceiptSplitAllocations, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId: args.receiptId,
        transactionId: receipt.linkedTransactionId,
      });
    }

    if (!receipt.linkedTransactionId && typeof totalAmount === 'number') {
      const candidates: Doc<'transactions'>[] = await ctx.runQuery(
        api.receipts.listCandidateTransactions,
        {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId: args.receiptId,
        limit: 8,
        }
      );

      if (candidates.length) {
        console.log('[parse] found candidates:', merchantName);
        const normalizedMerchant = normalizeMerchantName(merchantName);
        const scored = candidates.map((tx) => {
          const txAmount = Math.abs(tx.amount);
          const receiptAmount =
            typeof totalAmount === 'number' ? Math.abs(totalAmount) : undefined;
          const { amountDiff, amountPct, amountScore } = computeAmountMatchScore(
            txAmount,
            receiptAmount
          );

          const dateScore = receiptDate
            ? (() => {
                const diff = diffDays(receiptDate, tx.date);
                if (diff === null) return 0.1;
                if (diff === 0) return 1;
                if (diff === 1) return 0.6;
                if (diff === 2) return 0.3;
                return 0;
              })()
            : 0.2;

          const txMerchant = normalizeMerchantName(tx.merchantName ?? tx.name);
          const merchantScore =
            normalizedMerchant && txMerchant
              ? txMerchant.includes(normalizedMerchant) ||
                normalizedMerchant.includes(txMerchant)
                ? 1
                : txMerchant.split(' ').some((token) => normalizedMerchant.includes(token))
                  ? 0.5
                  : 0
              : 0.1;

          const score = amountScore * 0.5 + dateScore * 0.3 + merchantScore * 0.2;

          return { tx, score, amountDiff: amountDiff ?? 0, amountPct };
        });

        const sorted = scored.sort((a, b) => b.score - a.score);
        const best = sorted[0];
        const runnerUp = sorted[1];

        const strongAmount =
          typeof totalAmount !== 'number' ||
          (best.amountPct !== null && best.amountPct <= 0.05);

        if (
          best &&
          best.score >= 0.75 &&
          strongAmount &&
          (!runnerUp || best.score - runnerUp.score >= 0.1)
        ) {
          await ctx.runMutation(api.receipts.linkToTransaction, {
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            receiptId: args.receiptId,
            transactionId: best.tx._id,
          });
        }
      }
    }

    return { status: 'parsed' };
  },
});

export const linkToTransaction = mutation({
  args: {
    ...ownerArgs,
    receiptId: v.id('receipts'),
    transactionId: v.id('transactions'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) throw new Error('Not authorized');

    const transaction = await ctx.db.get(args.transactionId);
    if (
      !transaction ||
      transaction.ownerId !== owner.ownerId ||
      transaction.ownerType !== owner.ownerType
    ) {
      throw new Error('Not authorized');
    }

    const mismatch = computeMismatch(receipt.totalAmount, transaction.amount);
    const linkStatus =
      mismatch && mismatch.diff > 0 ? 'linkedMismatch' : 'linked';
    const needsReview = linkStatus === 'linkedMismatch';

    await ctx.db.patch(args.receiptId, {
      linkedTransactionId: args.transactionId,
      linkStatus,
      needsReview,
      updatedAt: Date.now(),
    });

    await ctx.db.insert('receiptLinks', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      receiptId: args.receiptId,
      transactionId: args.transactionId,
      createdAt: Date.now(),
    });

    await ctx.runMutation(api.transactions.applyReceiptSplitAllocations, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      receiptId: args.receiptId,
      transactionId: args.transactionId,
    });
  },
});

export const markReviewed = mutation({
  args: {
    ...ownerArgs,
    receiptId: v.id('receipts'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }

    const patch: Record<string, unknown> = {
      needsReview: false,
      updatedAt: Date.now(),
    };
    if (receipt.linkStatus === 'linkedMismatch') {
      patch.linkStatus = 'linked';
    }

    await ctx.db.patch(args.receiptId, patch);
  },
});

export const updateLineItem = mutation({
  args: {
    ...ownerArgs,
    lineItemId: v.id('receiptLineItems'),
    name: v.string(),
    quantity: v.optional(v.number()),
    price: v.optional(v.number()),
    grocerySubCategoryId: v.optional(v.id('categories')),
    clearGrocerySubCategory: v.optional(v.boolean()),
    markReviewed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const lineItem = await ctx.db.get(args.lineItemId);
    if (!lineItem || lineItem.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }

    const receipt = await ctx.db.get(lineItem.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) {
      throw new Error('Not authorized');
    }

    const name = args.name.trim();
    if (!name.length) throw new Error('Name required');

    const { canonicalIndex, indexCanonicalItem } = await loadCanonicalIndex(ctx, owner);
    const canonicalId = await ensureCanonicalItem(
      ctx,
      owner,
      canonicalIndex,
      indexCanonicalItem,
      name,
      name
    );

    const needsReview =
      args.markReviewed === undefined ? lineItem.needsReview ?? false : !args.markReviewed;

    let grocerySubCategoryId = args.grocerySubCategoryId;
    if (args.clearGrocerySubCategory) {
      grocerySubCategoryId = undefined;
    }
    if (grocerySubCategoryId) {
      const { grocerySubcategoryIds } = await loadGroceryCategoryIndex(ctx, owner);
      if (!grocerySubcategoryIds.has(grocerySubCategoryId)) {
        throw new Error('Category must be a grocery subcategory.');
      }
    }

    const resolvedQuantity =
      args.quantity !== undefined ? args.quantity : lineItem.quantity;
    const resolvedPrice =
      args.price !== undefined ? args.price : lineItem.price;
    const lineTotal =
      args.quantity === undefined && args.price === undefined
        ? lineItem.lineTotal
        : computeLineTotal(resolvedQuantity, resolvedPrice);

    const patch: Record<string, unknown> = {
      name,
      quantity: resolvedQuantity,
      price: resolvedPrice,
      lineTotal,
      normalizedItemId: canonicalId,
      needsReview,
    };
    if (args.clearGrocerySubCategory) {
      patch.grocerySubCategoryId = undefined;
    } else if (grocerySubCategoryId) {
      patch.grocerySubCategoryId = grocerySubCategoryId;
    }

    await ctx.db.patch(args.lineItemId, patch);

    const allLineItems = await ctx.db
      .query('receiptLineItems')
      .filter((q) => q.eq(q.field('receiptId'), lineItem.receiptId))
      .collect();

    const priceByItem = new Map<string, { canonicalId: any; price: number }>();
    for (const item of allLineItems) {
      let normalizedItemId = item.normalizedItemId;
      if (!normalizedItemId) {
        const canonical = await ensureCanonicalItem(
          ctx,
          owner,
          canonicalIndex,
          indexCanonicalItem,
          item.name,
          item.name
        );
        normalizedItemId = canonical;
        await ctx.db.patch(item._id, { normalizedItemId });
      }

      if (typeof item.price === 'number' && item.price > 0) {
        const key = String(normalizedItemId);
        const current = priceByItem.get(key);
        if (!current || item.price < current.price) {
          priceByItem.set(key, { canonicalId: normalizedItemId, price: item.price });
        }
      }
    }

    const existingPrices = await ctx.db
      .query('itemPrices')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('receiptId'), lineItem.receiptId),
          q.eq(q.field('source'), 'receipt')
        )
      )
      .collect();
    for (const price of existingPrices) {
      await ctx.db.delete(price._id);
    }

    const currency = receipt.currency ?? 'USD';
    const purchasedAt = parseReceiptDateToTimestamp(receipt.receiptDate ?? undefined);
    for (const entry of priceByItem.values()) {
      await ctx.db.insert('itemPrices', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        canonicalItemId: entry.canonicalId,
        receiptId: lineItem.receiptId,
        price: entry.price,
        currency,
        source: 'receipt',
        isEstimated: false,
        purchasedAt,
      });
    }

    if (receipt.linkedTransactionId) {
      await ctx.runMutation(api.transactions.applyReceiptSplitAllocations, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId: receipt._id,
        transactionId: receipt.linkedTransactionId,
      });
    }
  },
});

// Internal helpers
export const getByIdInternal = query({
  args: {
    ...ownerArgs,
    receiptId: v.id('receipts'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) return null;
    return receipt;
  },
});

export const listCanonicalItemsInternal = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('canonicalItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
  },
});

export const applyParsedInternal = mutation({
  args: {
    ...ownerArgs,
    receiptId: v.id('receipts'),
    merchantName: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    receiptDate: v.optional(v.string()),
    confidence: v.optional(v.number()),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.optional(v.number()),
        price: v.optional(v.number()),
        lineTotal: v.optional(v.number()),
        confidence: v.optional(v.number()),
        needsReview: v.optional(v.boolean()),
        canonicalName: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId) throw new Error('Not authorized');

    const currency = args.currency ?? receipt.currency ?? 'USD';
    const purchasedAt = parseReceiptDateToTimestamp(
      args.receiptDate ?? receipt.receiptDate ?? undefined
    );

    const patch: Record<string, unknown> = {
      status: 'parsed',
      updatedAt: Date.now(),
    };
    if (args.merchantName) patch.merchantName = args.merchantName;
    if (typeof args.totalAmount === 'number') patch.totalAmount = args.totalAmount;
    if (args.currency) patch.currency = args.currency;
    if (args.receiptDate) patch.receiptDate = args.receiptDate;
    if (typeof args.confidence === 'number') patch.confidence = args.confidence;

    await ctx.db.patch(args.receiptId, patch);

    const existingItems = await ctx.db
      .query('receiptLineItems')
      .filter((q) => q.eq(q.field('receiptId'), args.receiptId))
      .collect();
    for (const item of existingItems) {
      await ctx.db.delete(item._id);
    }

    const { canonicalIndex, indexCanonicalItem } = await loadCanonicalIndex(ctx, owner);

    const existingPrices = await ctx.db
      .query('itemPrices')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('receiptId'), args.receiptId),
          q.eq(q.field('source'), 'receipt')
        )
      )
      .collect();
    for (const price of existingPrices) {
      await ctx.db.delete(price._id);
    }

    const priceByItem = new Map<string, { canonicalId: any; price: number }>();

    for (const item of args.items) {
      const canonicalName = (item.canonicalName ?? item.name).trim() || item.name;
      const canonicalId = await ensureCanonicalItem(
        ctx,
        owner,
        canonicalIndex,
        indexCanonicalItem,
        canonicalName,
        item.name
      );

      await ctx.db.insert('receiptLineItems', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId: args.receiptId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        lineTotal: item.lineTotal ?? computeLineTotal(item.quantity, item.price),
        confidence: item.confidence,
        needsReview: item.needsReview,
        normalizedItemId: canonicalId,
      });

      if (typeof item.price === 'number' && item.price > 0) {
        const key = String(canonicalId);
        const current = priceByItem.get(key);
        if (!current || item.price < current.price) {
          priceByItem.set(key, { canonicalId, price: item.price });
        }
      }
    }

    for (const entry of priceByItem.values()) {
      await ctx.db.insert('itemPrices', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        canonicalItemId: entry.canonicalId,
        receiptId: args.receiptId,
        price: entry.price,
        currency,
        source: 'receipt',
        isEstimated: false,
        purchasedAt,
      });
    }
  },
});
