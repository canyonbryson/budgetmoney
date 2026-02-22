import { v } from 'convex/values';
import { action, internalAction, internalQuery, mutation, query } from './_generated/server';
import { api, internal } from './_generated/api';
import { Id } from './_generated/dataModel';
import { ownerArgs, resolveOwner, requireSignedIn, type Owner } from './ownership';
import { defaultIncludeInBudget, inferNetWorthRole, resolveIncludeInBudget } from './netWorthUtils';

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
  ownerType: Owner['ownerType'];
  ownerId: string;
  plaidItemId: string;
  accessToken: string;
  status?: 'active' | 'disconnected';
};

export type SyncResult = {
  status: 'ok' | 'partial' | 'error';
  ownersProcessed: number;
  itemsSynced: number;
  itemsFailed: number;
  message?: string;
};

export function summarizeSyncResult(args: {
  ownersProcessed: number;
  itemsSynced: number;
  itemsFailed: number;
  message?: string;
}): SyncResult {
  if (args.itemsFailed === 0) {
    return {
      status: 'ok',
      ownersProcessed: args.ownersProcessed,
      itemsSynced: args.itemsSynced,
      itemsFailed: args.itemsFailed,
      message: args.message,
    };
  }
  if (args.itemsSynced === 0) {
    return {
      status: 'error',
      ownersProcessed: args.ownersProcessed,
      itemsSynced: args.itemsSynced,
      itemsFailed: args.itemsFailed,
      message: args.message,
    };
  }
  return {
    status: 'partial',
    ownersProcessed: args.ownersProcessed,
    itemsSynced: args.itemsSynced,
    itemsFailed: args.itemsFailed,
    message: args.message,
  };
}

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
  handler: async (ctx, args): Promise<SyncResult> => {
    await requireSignedIn(ctx);
    const owner = await resolveOwner(ctx, args);
    return await ctx.runAction(internal.plaid.syncTransactionsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
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
    const owner = await resolveOwner(ctx, args);
    return await ctx.runAction(internal.plaid.syncTransactionsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      plaidItemId: args.plaidItemId,
    });
  },
});

export const syncTransactionsInternal = internalAction({
  args: {
    ...ownerArgs,
    plaidItemId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<SyncResult> => {
    const auth = await ctx.auth.getUserIdentity();
    const owner = auth
      ? await resolveOwner(ctx, args)
      : ({ ownerType: args.ownerType, ownerId: args.ownerId } as Owner);
    const items = (await ctx.runQuery(internal.plaid.listItemsInternal, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    })) as PlaidItemDoc[];

    const activeItems = items.filter((item) => item.status !== 'disconnected');
    const targetItems = args.plaidItemId
      ? activeItems.filter((item) => item.plaidItemId === args.plaidItemId)
      : activeItems;

    if (!targetItems.length) {
      return summarizeSyncResult({
        ownersProcessed: 1,
        itemsSynced: 0,
        itemsFailed: 0,
        message: 'No active bank items to sync.',
      });
    }

    let itemsSynced = 0;
    let itemsFailed = 0;

    for (const item of targetItems) {
      try {
        const syncState = await ctx.runQuery(internal.syncState.getByItemInternal, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
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
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            transactions: filtered,
          });
        }

        if (removed.length) {
          await ctx.runMutation(internal.transactionsSync.removeByPlaidIdsInternal, {
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            plaidTransactionIds: removed.map((r) => r.transaction_id),
          });
        }

        await ctx.runMutation(internal.syncState.upsertForSyncInternal, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          plaidItemIdRef: item._id,
          cursor,
          lastSyncAt: Date.now(),
          lastSyncStatus: 'success',
          lastSyncError: '',
        });
        itemsSynced += 1;
      } catch (error: any) {
        itemsFailed += 1;
        await ctx.runMutation(internal.syncState.upsertForSyncInternal, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          plaidItemIdRef: item._id,
          lastSyncAt: Date.now(),
          lastSyncStatus: 'error',
          lastSyncError: error?.message ?? 'Unknown sync error.',
        });
      }
    }

    if (itemsSynced > 0) {
      await ctx.runMutation(internal.netWorth.captureSnapshotInternal, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });
    }

    return summarizeSyncResult({
      ownersProcessed: 1,
      itemsSynced,
      itemsFailed,
      message: itemsFailed > 0 ? 'Some bank items failed to sync.' : undefined,
    });
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

    await ctx.runMutation(internal.syncState.upsertForSyncInternal, {
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

export const pollAllOwnersInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<SyncResult> => {
    const owners = await ctx.runQuery(internal.plaid.listActiveOwnersInternal, {});
    if (!owners.length) {
      return summarizeSyncResult({
        ownersProcessed: 0,
        itemsSynced: 0,
        itemsFailed: 0,
        message: 'No active Plaid owners to poll.',
      });
    }

    let ownersProcessed = 0;
    let itemsSynced = 0;
    let itemsFailed = 0;
    for (const owner of owners) {
      const result = await ctx.runAction(internal.plaid.syncTransactionsInternal, {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });
      ownersProcessed += 1;
      itemsSynced += result.itemsSynced;
      itemsFailed += result.itemsFailed;
    }

    return summarizeSyncResult({
      ownersProcessed,
      itemsSynced,
      itemsFailed,
      message: itemsFailed > 0 ? 'Polling completed with some sync failures.' : undefined,
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
        const role = existing.netWorthRole ?? inferNetWorthRole(acct.type, acct.subtype);
        await ctx.db.patch(existing._id, {
          name: acct.name,
          mask: acct.mask,
          subtype: acct.subtype,
          type: acct.type,
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          netWorthRole: role,
          includeInBudget: resolveIncludeInBudget({
            includeInBudget: existing.includeInBudget,
            netWorthRole: role,
            type: acct.type,
            subtype: acct.subtype,
          }),
          includeInNetWorth: existing.includeInNetWorth ?? true,
          netWorthBucketId: existing.netWorthBucketId,
          updatedAt: now,
        });
      } else {
        const role = inferNetWorthRole(acct.type, acct.subtype);
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
          netWorthRole: role,
          includeInBudget: defaultIncludeInBudget(role),
          includeInNetWorth: true,
          updatedAt: now,
        });
      }
    }
  },
});

export const updateAccountPreferences = mutation({
  args: {
    ...ownerArgs,
    plaidAccountId: v.string(),
    netWorthRole: v.optional(
      v.union(
        v.literal('checking'),
        v.literal('savings'),
        v.literal('investment'),
        v.literal('liability')
      )
    ),
    includeInBudget: v.optional(v.boolean()),
    includeInNetWorth: v.optional(v.boolean()),
    netWorthBucketId: v.optional(v.union(v.id('netWorthBuckets'), v.null())),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const account = await ctx.db
      .query('plaidAccounts')
      .withIndex('by_owner_plaidAccountId', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId).eq('plaidAccountId', args.plaidAccountId)
      )
      .unique();
    if (!account) throw new Error('Account not found');

    const nextRole = args.netWorthRole ?? account.netWorthRole ?? inferNetWorthRole(account.type, account.subtype);
    const nextIncludeInBudget =
      typeof args.includeInBudget === 'boolean'
        ? args.includeInBudget
        : resolveIncludeInBudget({
            includeInBudget: account.includeInBudget,
            netWorthRole: nextRole,
            type: account.type,
            subtype: account.subtype,
          });
    const nextIncludeInNetWorth =
      typeof args.includeInNetWorth === 'boolean' ? args.includeInNetWorth : (account.includeInNetWorth ?? true);

    await ctx.db.patch(account._id, {
      netWorthRole: nextRole,
      includeInBudget: nextIncludeInBudget,
      includeInNetWorth: nextIncludeInNetWorth,
      netWorthBucketId: args.netWorthBucketId === null ? undefined : (args.netWorthBucketId ?? account.netWorthBucketId),
      updatedAt: Date.now(),
    });
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

export const listActiveOwnersInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = (await ctx.db.query('plaidItems').collect()) as PlaidItemDoc[];
    const seen = new Set<string>();
    const owners: Array<{ ownerType: Owner['ownerType']; ownerId: string }> = [];
    for (const item of items) {
      if (item.status === 'disconnected') continue;
      const key = `${item.ownerType}:${item.ownerId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      owners.push({ ownerType: item.ownerType, ownerId: item.ownerId });
    }
    return owners;
  },
});
