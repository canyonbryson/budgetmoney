import { v } from 'convex/values';
import { action, internalAction, internalQuery, mutation, query } from './_generated/server';
import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { ownerArgs, resolveOwner, requireSignedIn } from './ownership';

type PlaidEnv = 'sandbox' | 'development' | 'production';
type PlaidTransaction = {
  transaction_id: string;
  account_id: string;
  date: string;
  authorized_date?: string | null;
  name: string;
  merchant_name?: string | null;
  amount: number;
  iso_currency_code?: string | null;
  pending: boolean;
  mcc?: string | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
    confidence_level?: string | null;
  } | null;
};
type PlaidRemoved = { transaction_id: string };
type PlaidAccount = {
  account_id: string;
  name: string;
  mask?: string | null;
  subtype?: string | null;
  type?: string | null;
  balances?: { current?: number | null; available?: number | null };
};
type PlaidItemDoc = {
  _id: Id<'plaidItems'>;
  ownerType: 'device' | 'user';
  ownerId: string;
  plaidItemId: string;
  accessToken: string;
};
type SyncResult = { status: 'ok' };

export function formatPlaidErrorMessage(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as {
      error_code?: string;
      error_message?: string;
      display_message?: string | null;
    };
    if (parsed.error_code === 'INVALID_API_KEYS') {
      return 'Plaid credentials are invalid. Update PLAID_CLIENT_ID and PLAID_SECRET.';
    }
    const message = parsed.display_message ?? parsed.error_message;
    if (message) {
      return `Plaid error ${status}: ${message}`;
    }
  } catch {
    // Ignore JSON parsing errors and fall back to a generic message.
  }
  return `Plaid error ${status}: ${body}`;
}

function getPlaidBaseUrl() {
  const env = (process.env.PLAID_ENV ?? 'sandbox') as PlaidEnv;
  if (env !== 'sandbox') {
    throw new Error('Only sandbox is supported for GroceryBudget.');
  }
  if (env === 'sandbox') return 'https://sandbox.plaid.com';
  if (env === 'development') return 'https://development.plaid.com';
  return 'https://production.plaid.com';
}

async function plaidRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  if (!clientId || !secret) {
    throw new Error('Missing Plaid credentials. Set PLAID_CLIENT_ID and PLAID_SECRET.');
  }
  const baseUrl = getPlaidBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, ...body }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatPlaidErrorMessage(response.status, text));
  }
  return (await response.json()) as T;
}

export const listItems = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('plaidItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
  },
});

export const listAccounts = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('plaidAccounts')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId)
        )
      )
      .collect();
  },
});

export const createLinkToken = action({
  args: ownerArgs,
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    const result = await plaidRequest<{ link_token: string }>('/link/token/create', {
      client_name: 'GroceryBudget',
      language: 'en',
      country_codes: ['US'],
      products: ['transactions'],
      user: {
        client_user_id: `${owner.ownerType}:${owner.ownerId}`,
      },
      transactions: {
        days_requested: 30,
      },
      webhook: process.env.PLAID_WEBHOOK_URL ?? undefined,
    });
    return { link_token: result.link_token };
  },
});

export const syncNow = action({
  args: ownerArgs,
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    await ctx.runAction(internal.plaid.syncTransactionsInternal, {
      ownerType: args.ownerType,
      ownerId: args.ownerId,
    });
  },
});

export const syncTransactions = action({
  args: {
    ...ownerArgs,
    plaidItemId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    await requireSignedIn(ctx);
    return await ctx.runAction(internal.plaid.syncTransactionsInternal, args);
  },
});

export const syncTransactionsInternal = internalAction({
  args: {
    ...ownerArgs,
    plaidItemId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const items = (await ctx.runQuery(internal.plaid.listItemsInternal, {
      ownerType: args.ownerType,
      ownerId: args.ownerId,
    })) as PlaidItemDoc[];

    const targetItems = args.plaidItemId
      ? items.filter((item) => item.plaidItemId === args.plaidItemId)
      : items;

    for (const item of targetItems) {
      const syncState = await ctx.runQuery(api.syncState.getByItem, {
        ownerType: args.ownerType,
        ownerId: args.ownerId,
        plaidItemIdRef: item._id,
      });

      const isInitialSync = !syncState?.cursor;
      let cursor = syncState?.cursor ?? undefined;
      let hasMore = true;
      const added: PlaidTransaction[] = [];
      const modified: PlaidTransaction[] = [];
      const removed: PlaidRemoved[] = [];

      while (hasMore) {
        const result = await plaidRequest<{
          added: PlaidTransaction[];
          modified: PlaidTransaction[];
          removed: PlaidRemoved[];
          next_cursor: string;
          has_more: boolean;
        }>('/transactions/sync', {
          access_token: item.accessToken,
          cursor,
          options: {
            include_personal_finance_category: true,
          },
        });

        added.push(...result.added);
        modified.push(...result.modified);
        removed.push(...result.removed);
        cursor = result.next_cursor;
        hasMore = result.has_more;
      }

      const mapped = [...added, ...modified].map((tx) => ({
        plaidTransactionId: tx.transaction_id,
        plaidAccountId: tx.account_id,
        date: tx.date,
        authorizedDate: tx.authorized_date ?? undefined,
        name: tx.name,
        merchantName: tx.merchant_name ?? undefined,
        amount: tx.amount,
        currency: tx.iso_currency_code ?? 'USD',
        pending: Boolean(tx.pending),
        mcc: tx.mcc ? String(tx.mcc) : undefined,
        personalFinanceCategoryPrimary: tx.personal_finance_category?.primary ?? undefined,
        personalFinanceCategoryDetailed: tx.personal_finance_category?.detailed ?? undefined,
      }));

      const filtered = isInitialSync
        ? (() => {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            const cutoffStr = cutoff.toISOString().slice(0, 10);
            return mapped.filter((tx) => tx.date >= cutoffStr);
          })()
        : mapped;

      if (filtered.length) {
        await ctx.runMutation(internal.transactionsSync.upsertFromPlaidSyncInternal, {
          ownerType: args.ownerType,
          ownerId: args.ownerId,
          transactions: filtered,
        });
      }

      if (removed.length) {
        await ctx.runMutation(internal.transactionsSync.removeByPlaidIdsInternal, {
          ownerType: args.ownerType,
          ownerId: args.ownerId,
          plaidTransactionIds: removed.map((r) => r.transaction_id),
        });
      }

      await ctx.runMutation(api.syncState.upsertInternal, {
        ownerType: args.ownerType,
        ownerId: args.ownerId,
        plaidItemIdRef: item._id,
        cursor,
        lastSyncAt: Date.now(),
        lastSyncStatus: 'success',
      });
    }

    return { status: 'ok' };
  },
});

export const disconnect = mutation({
  args: {
    ...ownerArgs,
    plaidItemId: v.string(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const item = await ctx.db
      .query('plaidItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('plaidItemId'), args.plaidItemId)
        )
      )
      .first();
    if (!item) return;
    await ctx.db.patch(item._id, { status: 'disconnected', updatedAt: Date.now() });
  },
});

export const exchangePublicToken = action({
  args: {
    ...ownerArgs,
    publicToken: v.string(),
    institutionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();

    const exchange = await plaidRequest<{ access_token: string; item_id: string }>(
      '/item/public_token/exchange',
      {
        public_token: args.publicToken,
      }
    );

    const itemId = await ctx.runMutation(api.plaid.upsertItemInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemId: exchange.item_id,
      accessToken: exchange.access_token,
      institutionName: args.institutionName,
    });

    const accounts = await plaidRequest<{ accounts: PlaidAccount[] }>('/accounts/get', {
      access_token: exchange.access_token,
    });

    await ctx.runMutation(api.plaid.upsertAccountsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemIdRef: itemId,
      accounts: accounts.accounts.map((acct) => ({
        plaidAccountId: acct.account_id,
        name: acct.name,
        mask: acct.mask ?? undefined,
        subtype: acct.subtype ?? undefined,
        type: acct.type ?? undefined,
        currentBalance: acct.balances?.current ?? undefined,
        availableBalance: acct.balances?.available ?? undefined,
      })),
    });

    await ctx.runMutation(api.syncState.upsertInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemIdRef: itemId,
      lastSyncAt: now,
      lastSyncStatus: 'success',
    });

    await ctx.runAction(internal.plaid.syncTransactionsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemId: exchange.item_id,
    });
  },
});

export const upsertItemInternal = mutation({
  args: {
    ...ownerArgs,
    plaidItemId: v.string(),
    accessToken: v.string(),
    institutionName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    const existing = await ctx.db
      .query('plaidItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), owner.ownerType),
          q.eq(q.field('ownerId'), owner.ownerId),
          q.eq(q.field('plaidItemId'), args.plaidItemId)
        )
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        institutionName: args.institutionName ?? existing.institutionName,
        status: 'active',
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert('plaidItems', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemId: args.plaidItemId,
      accessToken: args.accessToken,
      institutionName: args.institutionName,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const upsertAccountsInternal = mutation({
  args: {
    ...ownerArgs,
    plaidItemIdRef: v.id('plaidItems'),
    accounts: v.array(
      v.object({
        plaidAccountId: v.string(),
        name: v.string(),
        mask: v.optional(v.string()),
        subtype: v.optional(v.string()),
        type: v.optional(v.string()),
        currentBalance: v.optional(v.number()),
        availableBalance: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    for (const acct of args.accounts) {
      const existing = await ctx.db
        .query('plaidAccounts')
        .filter((q) =>
          q.and(
            q.eq(q.field('ownerType'), owner.ownerType),
            q.eq(q.field('ownerId'), owner.ownerId),
            q.eq(q.field('plaidAccountId'), acct.plaidAccountId)
          )
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          name: acct.name,
          mask: acct.mask,
          subtype: acct.subtype,
          type: acct.type,
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          updatedAt: now,
        });
      } else {
        await ctx.db.insert('plaidAccounts', {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          plaidItemIdRef: args.plaidItemIdRef,
          plaidAccountId: acct.plaidAccountId,
          name: acct.name,
          mask: acct.mask,
          subtype: acct.subtype,
          type: acct.type,
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          updatedAt: now,
        });
      }
    }
  },
});

export const listItemsInternal = internalQuery({
  args: ownerArgs,
  handler: async (ctx, args) => {
    return ctx.db
      .query('plaidItems')
      .filter((q) =>
        q.and(
          q.eq(q.field('ownerType'), args.ownerType),
          q.eq(q.field('ownerId'), args.ownerId)
        )
      )
      .collect();
  },
});

export const getItemByPlaidIdInternal = internalQuery({
  args: { plaidItemId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query('plaidItems')
      .withIndex('by_plaidItemId', (q) => q.eq('plaidItemId', args.plaidItemId))
      .first();
  },
});
