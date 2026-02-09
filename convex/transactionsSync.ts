import { v } from 'convex/values';
import { internalMutation, mutation } from './_generated/server';
import { Doc } from './_generated/dataModel';
import { ownerArgs, resolveOwner } from './ownership';
import { categorizeTransaction } from './categorize';
import { Owner } from './ownership';
import { callOpenAIJson } from './openai';

async function upsertTransactions(
  ctx: any,
  owner: Owner,
  transactions: Array<{
    plaidTransactionId: string;
    plaidAccountId?: string;
    date: string;
    authorizedDate?: string;
    name: string;
    merchantName?: string;
    amount: number;
    currency: string;
    pending: boolean;
    mcc?: string;
    personalFinanceCategoryPrimary?: string;
    personalFinanceCategoryDetailed?: string;
  }>
) {
  const now = Date.now();
  const categories: Doc<'categories'>[] = await ctx.db
    .query('categories')
    .filter((q: any) =>
      q.and(q.eq(q.field('ownerType'), owner.ownerType), q.eq(q.field('ownerId'), owner.ownerId))
    )
    .collect();
  const categoryByName = new Map(
    categories
      .filter((cat) => typeof cat.name === 'string')
      .map((cat) => [String(cat.name).toLowerCase(), String(cat._id)])
  );
  const categoryById = new Map(categories.map((cat) => [String(cat._id), cat]));
  const categoryByNameLookup = new Map(
    categories
      .filter((cat) => typeof cat.name === 'string')
      .map((cat) => [String(cat.name).toLowerCase(), cat])
  );

  const accounts: Doc<'plaidAccounts'>[] = await ctx.db
    .query('plaidAccounts')
    .filter((q: any) =>
      q.and(q.eq(q.field('ownerType'), owner.ownerType), q.eq(q.field('ownerId'), owner.ownerId))
    )
    .collect();
  const accountByPlaidId = new Map(accounts.map((acct) => [acct.plaidAccountId, acct]));

  const categorized = [];
  for (const tx of transactions) {
    const existing = await ctx.db
      .query('transactions')
      .withIndex('by_owner_plaid_tx', (q: any) =>
        q.eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('plaidTransactionId', tx.plaidTransactionId)
      )
      .first();

    const account = tx.plaidAccountId ? accountByPlaidId.get(tx.plaidAccountId) : undefined;
    const categorization = await categorizeTransaction(
      ctx,
      owner,
      {
      name: tx.name,
      merchantName: tx.merchantName,
      mcc: tx.mcc,
      amount: tx.amount,
      personalFinanceCategoryPrimary: tx.personalFinanceCategoryPrimary,
      accountType: account?.type,
      },
      {
        categoryByName,
      }
    );

    categorized.push({
      tx,
      existing,
      categorization,
    });
  }

  const shouldRunAi = owner.ownerType === 'user' && Boolean(process.env.OPENAI_API_KEY);
  if (shouldRunAi) {
    try {
      const aiCandidates = categorized.filter(
        (item) =>
          !item.categorization.categoryId &&
          item.categorization.source === 'none' &&
          !item.categorization.isTransfer &&
          !item.categorization.isCreditCardPayment
      );

      if (aiCandidates.length && categories.length) {
        const categoryOptions = categories.map((cat) => {
          const parent = cat.parentId ? categoryById.get(String(cat.parentId)) : undefined;
          const childName = cat.name ?? 'Category';
          const parentName = parent?.name ?? 'Category';
          const label = parent ? `${parentName} > ${childName}` : childName;
          return { id: String(cat._id), label };
        });

        const batches: typeof aiCandidates[] = [];
        const batchSize = 20;
        for (let i = 0; i < aiCandidates.length; i += batchSize) {
          batches.push(aiCandidates.slice(i, i + batchSize));
        }

        for (const batch of batches) {
          const systemPrompt = [
            'You are a finance categorization assistant.',
            'Choose the best category for each transaction from the provided list.',
            'Return null if none match well.',
          ].join(' ');

          const userPrompt = [
            `Categories: ${categoryOptions.map((c) => `${c.id}: ${c.label}`).join(' | ')}`,
            'Transactions:',
            ...batch.map(
              (item) =>
                `- id=${item.tx.plaidTransactionId} name="${item.tx.name}" merchant="${item.tx.merchantName ?? ''}" amount=${item.tx.amount} date=${item.tx.date}`
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
          const parsed = await callOpenAIJson<{
            results: { transaction_id: string; category_id: string | null; confidence: number }[];
          }>({
            model,
            input: [
              { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
              { role: 'user', content: [{ type: 'input_text', text: userPrompt }] },
            ],
            schema: { name: 'transaction_categorization', schema, strict: true },
            temperature: 0.1,
            maxOutputTokens: 800,
          });

          for (const result of parsed.results ?? []) {
            if (!result.category_id) continue;
            const matched =
              categoryById.get(result.category_id) ||
              categoryByNameLookup.get(result.category_id.toLowerCase());
            if (!matched) continue;
            const target = batch.find((item) => item.tx.plaidTransactionId === result.transaction_id);
            if (!target) continue;
            target.categorization.categoryId = matched._id;
            target.categorization.source = 'ai';
            target.categorization.confidence = result.confidence ?? 0.6;
          }
        }
      }
    } catch {
      // Ignore AI failures and keep deterministic categories.
    }
  }

  for (const item of categorized) {
    const { tx, existing, categorization } = item;

    const data = {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidTransactionId: tx.plaidTransactionId,
      plaidAccountId: tx.plaidAccountId,
      date: tx.date,
      authorizedDate: tx.authorizedDate,
      name: tx.name,
      merchantName: tx.merchantName,
      amount: tx.amount,
      currency: tx.currency,
      pending: tx.pending,
      mcc: tx.mcc,
      categoryId: categorization.categoryId ?? undefined,
      autoCategoryId: categorization.categoryId ?? undefined,
      categorizationSource: categorization.source,
      confidence: categorization.confidence,
      isTransfer: categorization.isTransfer ?? undefined,
      isRefund: categorization.isRefund ?? undefined,
      isCreditCardPayment: categorization.isCreditCardPayment ?? undefined,
      isCreditPurchase: categorization.isCreditPurchase ?? undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert('transactions', {
        ...data,
        createdAt: now,
      });
    }
  }
}

async function removeTransactions(
  ctx: any,
  owner: Owner,
  plaidTransactionIds: string[]
) {
  for (const id of plaidTransactionIds) {
    const existing = await ctx.db
      .query('transactions')
      .withIndex('by_owner_plaid_tx', (q: any) =>
        q.eq('ownerType', owner.ownerType)
          .eq('ownerId', owner.ownerId)
          .eq('plaidTransactionId', id)
      )
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  }
}

export const upsertFromPlaidSync = mutation({
  args: {
    ...ownerArgs,
    transactions: v.array(
      v.object({
        plaidTransactionId: v.string(),
        plaidAccountId: v.optional(v.string()),
        date: v.string(),
        authorizedDate: v.optional(v.string()),
        name: v.string(),
        merchantName: v.optional(v.string()),
        amount: v.number(),
        currency: v.string(),
        pending: v.boolean(),
        mcc: v.optional(v.string()),
        personalFinanceCategoryPrimary: v.optional(v.string()),
        personalFinanceCategoryDetailed: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await upsertTransactions(ctx, owner, args.transactions);
  },
});

export const upsertFromPlaidSyncInternal = internalMutation({
  args: {
    ...ownerArgs,
    transactions: v.array(
      v.object({
        plaidTransactionId: v.string(),
        plaidAccountId: v.optional(v.string()),
        date: v.string(),
        authorizedDate: v.optional(v.string()),
        name: v.string(),
        merchantName: v.optional(v.string()),
        amount: v.number(),
        currency: v.string(),
        pending: v.boolean(),
        mcc: v.optional(v.string()),
        personalFinanceCategoryPrimary: v.optional(v.string()),
        personalFinanceCategoryDetailed: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = { ownerType: args.ownerType, ownerId: args.ownerId } as Owner;
    await upsertTransactions(ctx, owner, args.transactions);
  },
});

export const removeByPlaidIds = mutation({
  args: {
    ...ownerArgs,
    plaidTransactionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    await removeTransactions(ctx, owner, args.plaidTransactionIds);
  },
});

export const removeByPlaidIdsInternal = internalMutation({
  args: {
    ...ownerArgs,
    plaidTransactionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = { ownerType: args.ownerType, ownerId: args.ownerId } as Owner;
    await removeTransactions(ctx, owner, args.plaidTransactionIds);
  },
});
