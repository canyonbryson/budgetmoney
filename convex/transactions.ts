import { v } from 'convex/values';
import { action, mutation, query } from './_generated/server';
import { Doc, Id } from './_generated/dataModel';
import { api } from './_generated/api';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';
import { callOpenAIJson } from './openai';
import { getCategoryKind } from './categoryKinds';
import { ensureDefaultIncomeCategoryForOwner } from './categories';

type UncategorizedTransaction = {
  _id: Id<'transactions'>;
  name: string;
  merchantName?: string;
  amount: number;
  date: string;
  mcc?: string;
};

function normalizeMerchant(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
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

export function buildCategoryScope(
  categories: Array<{ _id: Id<'categories'>; parentId?: Id<'categories'> }>,
  categoryId: Id<'categories'>
) {
  const scope = new Set<Id<'categories'>>([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories) {
      if (!category.parentId) continue;
      if (scope.has(category.parentId) && !scope.has(category._id)) {
        scope.add(category._id);
        changed = true;
      }
    }
  }
  return scope;
}

export const list = query({
  args: {
    ...ownerArgs,
    limit: v.optional(v.number()),
    search: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    categoryId: v.optional(v.id('categories')),
    uncategorizedOnly: v.optional(v.boolean()),
    accountId: v.optional(v.string()),
    minAmount: v.optional(v.number()),
    maxAmount: v.optional(v.number()),
    pending: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    let q = ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      );

    if (args.startDate) {
      q = q.filter((f) => f.gte(f.field('date'), args.startDate!));
    }
    if (args.endDate) {
      q = q.filter((f) => f.lte(f.field('date'), args.endDate!));
    }
    if (args.accountId) {
      q = q.filter((f) => f.eq(f.field('plaidAccountId'), args.accountId));
    }
    if (args.minAmount !== undefined) {
      q = q.filter((f) => f.gte(f.field('amount'), args.minAmount!));
    }
    if (args.maxAmount !== undefined) {
      q = q.filter((f) => f.lte(f.field('amount'), args.maxAmount!));
    }
    if (args.pending !== undefined) {
      q = q.filter((f) => f.eq(f.field('pending'), args.pending));
    }

    const categories = await ctx.db
      .query('categories')
      .filter((f) =>
        f.and(
          f.eq(f.field('ownerType'), owner.ownerType),
          f.eq(f.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));
    const categoryScope = args.categoryId
      ? buildCategoryScope(categories, args.categoryId)
      : undefined;

    const limit = args.limit ?? 50;
    const takeCount = args.search || categoryScope ? limit * 4 : limit;
    const items = await q.order('desc').take(takeCount);

    let filtered = items;
    if (categoryScope && !args.uncategorizedOnly) {
      filtered = filtered.filter(
        (item) => Boolean(item.categoryId) && categoryScope.has(item.categoryId!)
      );
    }
    if (args.uncategorizedOnly) {
      filtered = filtered.filter((item) => !item.categoryId);
    }
    if (args.search) {
      const needle = args.search.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name.toLowerCase().includes(needle) ||
        (item.merchantName ? item.merchantName.toLowerCase().includes(needle) : false)
      );
    }
    if (filtered.length > limit) {
      filtered = filtered.slice(0, limit);
    }

    return {
      items: filtered.map((tx) => ({
        ...tx,
        categoryName: tx.categoryId ? categoryMap.get(tx.categoryId) : undefined,
      })),
    };
  },
});

export const createManual = mutation({
  args: {
    ...ownerArgs,
    date: v.string(),
    name: v.string(),
    amount: v.number(),
    categoryId: v.optional(v.id('categories')),
    notes: v.optional(v.string()),
    currency: v.optional(v.string()),
    pending: v.optional(v.boolean()),
  },
  returns: v.id('transactions'),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await ensureDefaultIncomeCategoryForOwner(ctx, owner);
    const parsedDate = Date.parse(args.date);
    if (Number.isNaN(parsedDate)) {
      throw new Error('Date must be valid (YYYY-MM-DD).');
    }
    const trimmedName = args.name.trim();
    if (!trimmedName.length) {
      throw new Error('Transaction name is required.');
    }
    if (!Number.isFinite(args.amount)) {
      throw new Error('Amount must be a number.');
    }
    const now = Date.now();
    const categoryId = args.categoryId;
    return await ctx.db.insert('transactions', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      date: args.date,
      name: trimmedName,
      merchantName: trimmedName,
      amount: args.amount,
      currency: args.currency ?? 'USD',
      pending: args.pending ?? false,
      categoryId,
      autoCategoryId: categoryId,
      categorizationSource: categoryId ? 'manual' : 'none',
      confidence: categoryId ? 1 : 0,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listUncategorized = query({
  args: {
    ...ownerArgs,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const limit = args.limit ?? 25;
    const items = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .order('desc')
      .take(limit * 4);

    const uncategorized = items
      .filter((tx) => !tx.categoryId && tx.categorizationSource === 'none')
      .slice(0, limit);

    return uncategorized.map((tx) => ({
      _id: tx._id,
      name: tx.name,
      merchantName: tx.merchantName,
      amount: tx.amount,
      date: tx.date,
      mcc: tx.mcc,
    }));
  },
});

export const setCategory = mutation({
  args: {
    ...ownerArgs,
    transactionId: v.id('transactions'),
    categoryId: v.id('categories'),
    rememberRule: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const tx = await ctx.db.get(args.transactionId);
    if (!tx || tx.ownerId !== owner.ownerId || tx.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }

    const category = await ctx.db.get(args.categoryId);
    const isTransfer = category ? getCategoryKind(category) === 'transfer' : false;

    await ctx.db.patch(args.transactionId, {
      categoryId: args.categoryId,
      categorizationSource: 'manual',
      confidence: 1,
      isTransfer,
      updatedAt: Date.now(),
    });

    if (args.rememberRule) {
      console.log('[setCategory] remembering rule for merchant:', tx.merchantName, tx.name);
      const merchant = normalizeMerchant(tx.name ?? tx.merchantName);
      const existing = await ctx.db
        .query('merchantRules')
        .filter((q) =>
          q.and(
            q.eq(q.field('ownerType'), owner.ownerType),
            q.eq(q.field('ownerId'), owner.ownerId),
            q.eq(q.field('normalizedMerchant'), merchant)
          )
        )
        .first();
      const now = Date.now();
      if (existing) {
        await ctx.db.patch(existing._id, { categoryId: args.categoryId, updatedAt: now });
      } else {
        await ctx.db.insert('merchantRules', {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          normalizedMerchant: merchant,
          categoryId: args.categoryId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  },
});

export const applyReceiptSplitAllocations = mutation({
  args: {
    ...ownerArgs,
    transactionId: v.id('transactions'),
    receiptId: v.id('receipts'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const receipt = await ctx.db.get(args.receiptId);
    if (!receipt || receipt.ownerId !== owner.ownerId || receipt.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    const transaction = await ctx.db.get(args.transactionId);
    if (
      !transaction ||
      transaction.ownerId !== owner.ownerId ||
      transaction.ownerType !== owner.ownerType
    ) {
      throw new Error('Not authorized');
    }

    const lineItems = await ctx.db
      .query('receiptLineItems')
      .withIndex('by_receipt', (q) => q.eq('receiptId', receipt._id))
      .collect();

    const categories = await ctx.db
      .query('categories')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();

    const groceriesParent =
      categories.find(
        (cat) => !cat.parentId && cat.name?.toLowerCase() === 'groceries'
      ) ?? categories.find((cat) => cat.name?.toLowerCase() === 'groceries');
    const groceriesParentId = groceriesParent?._id;

    const grocerySubcategoryIds = new Set(
      groceriesParentId
        ? categories.filter((cat) => cat.parentId === groceriesParentId).map((cat) => cat._id)
        : []
    );
    const categoryById = new Map(categories.map((cat) => [cat._id, cat]));

    const existingSplits = await ctx.db
      .query('transactionSplits')
      .withIndex('by_receipt', (q) => q.eq('receiptId', receipt._id))
      .collect();
    for (const split of existingSplits) {
      await ctx.db.delete(split._id);
    }

    if (!groceriesParentId || !grocerySubcategoryIds.size) {
      return null;
    }

    const txCategory = transaction.categoryId
      ? categoryById.get(transaction.categoryId)
      : null;
    const isGroceriesTransaction =
      txCategory &&
      (txCategory._id === groceriesParentId || txCategory.parentId === groceriesParentId);
    if (!isGroceriesTransaction) {
      return null;
    }

    const allocations = new Map<Id<'categories'>, number>();
    let rawTotal = 0;
    let hasUnassigned = false;

    for (const item of lineItems) {
      const lineTotal = computeLineTotal(item.quantity, item.price, item.lineTotal);
      if (!lineTotal || lineTotal <= 0) continue;
      if (!item.grocerySubCategoryId || !grocerySubcategoryIds.has(item.grocerySubCategoryId)) {
        hasUnassigned = true;
        continue;
      }
      rawTotal += lineTotal;
      allocations.set(
        item.grocerySubCategoryId,
        (allocations.get(item.grocerySubCategoryId) ?? 0) + lineTotal
      );
    }

    if (!allocations.size || rawTotal <= 0) {
      return null;
    }

    const txAmount = transaction.amount;
    const txAbs = Math.abs(txAmount);
    const sign = txAmount < 0 ? -1 : 1;
    const scale = !hasUnassigned && txAbs > 0 ? txAbs / rawTotal : 1;

    const entries = Array.from(allocations.entries());
    const now = Date.now();
    const targetTotal = scale !== 1 ? txAmount : rawTotal * sign;
    let running = 0;

    for (let index = 0; index < entries.length; index += 1) {
      const [categoryId, amount] = entries[index];
      const scaled = amount * scale * sign;
      const finalAmount =
        index === entries.length - 1 ? targetTotal - running : scaled;
      running += finalAmount;
      await ctx.db.insert('transactionSplits', {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        transactionId: transaction._id,
        receiptId: receipt._id,
        categoryId,
        amount: finalAmount,
        source: 'receipt',
        createdAt: now,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const applyAutoCategories = mutation({
  args: {
    ...ownerArgs,
    updates: v.array(
      v.object({
        transactionId: v.id('transactions'),
        categoryId: v.id('categories'),
        confidence: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    for (const update of args.updates) {
      const tx = await ctx.db.get(update.transactionId);
      if (!tx || tx.ownerId !== owner.ownerId || tx.ownerType !== owner.ownerType) {
        continue;
      }
      if (tx.categoryId) {
        continue;
      }
      const category = await ctx.db.get(update.categoryId);
      const isTransfer = category ? getCategoryKind(category) === 'transfer' : false;
      await ctx.db.patch(update.transactionId, {
        categoryId: update.categoryId,
        autoCategoryId: update.categoryId,
        categorizationSource: 'ai',
        confidence: update.confidence ?? 0.6,
        isTransfer,
        updatedAt: Date.now(),
      });
    }
  },
});

export const autoCategorizeMissing = action({
  args: {
    ...ownerArgs,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    await ctx.runMutation(api.categories.ensureIncomeCategory, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    });
    const categories: Doc<'categories'>[] = await ctx.runQuery(api.categories.list, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    });

    if (!categories.length) {
      return { updated: 0 };
    }

    const categoryById = new Map(categories.map((cat) => [String(cat._id), cat]));
    const categoryByName = new Map(
      categories
        .filter(
          (cat): cat is Doc<'categories'> & { name: string } =>
            typeof cat.name === 'string' && cat.name.length > 0
        )
        .map((cat) => [cat.name.toLowerCase(), cat])
    );
    const categoryOptions = categories.map((cat) => {
      const parent = cat.parentId
        ? categories.find((p) => p._id === cat.parentId)
        : undefined;
      const childName = cat.name ?? 'Category';
      const parentName = parent?.name ?? 'Category';
      const label = parent ? `${parentName} > ${childName}` : childName;
      return { id: String(cat._id), label };
    });

    const uncategorized: UncategorizedTransaction[] = await ctx.runQuery(
      api.transactions.listUncategorized,
      {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      limit: args.limit ?? 25,
      }
    );

    if (!uncategorized.length) {
      return { updated: 0 };
    }

    const systemPrompt = [
      'You are a finance categorization assistant.',
      'Choose the best category for each transaction from the provided list.',
      'Return null if none match well.',
    ].join(' ');

    const userPrompt = [
      `Categories: ${categoryOptions.map((c) => `${c.id}: ${c.label}`).join(' | ')}`,
      'Transactions:',
      ...uncategorized.map(
        (tx) =>
          `- id=${tx._id} name="${tx.name}" merchant="${tx.merchantName ?? ''}" amount=${tx.amount} date=${tx.date}`
      ),
    ].join('\n');

    const schema = {
      type: 'object',
      additionalProperties: false,
      required: ['results'],
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['transaction_id', 'category_id', 'confidence'],
            properties: {
              transaction_id: { type: 'string' },
              category_id: { type: ['string', 'null'] },
              confidence: { type: 'number' },
            },
          },
        },
      },
    } as const;

    const model = process.env.OPENAI_CATEGORIZE_MODEL ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    const parsed = await callOpenAIJson<{ results: { transaction_id: string; category_id: string | null; confidence: number }[] }>({
      model,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
        { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
      ],
      schema: { name: 'transaction_categorization', schema, strict: true },
      temperature: 0.1,
      maxOutputTokens: 800,
    });

    const updates = parsed.results
      .map(
        (
          result
        ): { transactionId: Id<'transactions'>; categoryId: Id<'categories'>; confidence: number } | null => {
        if (!result.category_id) return null;
        const matched =
          categoryById.get(result.category_id) ||
          categoryByName.get(result.category_id.toLowerCase());
        if (!matched) return null;
        return {
          transactionId: result.transaction_id as Id<'transactions'>,
          categoryId: matched._id,
          confidence: result.confidence,
        };
      }
      )
      .filter(Boolean) as { transactionId: Id<'transactions'>; categoryId: Id<'categories'>; confidence: number }[];

    if (!updates.length) {
      return { updated: 0 };
    }

    await ctx.runMutation(api.transactions.applyAutoCategories, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      updates,
    });

    return { updated: updates.length };
  },
});
