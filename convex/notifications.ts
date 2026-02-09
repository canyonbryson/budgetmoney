import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';
import { api } from './_generated/api';

const DEFAULT_SETTINGS = {
  budgetAlertsEnabled: true,
  budgetThresholdPct: 0.9,
  receiptAlertsEnabled: true,
  creditDueAlertsEnabled: true,
  creditDueDaysBefore: 3,
  weeklySummaryEnabled: true,
  monthlySummaryEnabled: true,
};

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffDays(from: string, to: string) {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const diffMs = b.getTime() - a.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function loadSettings(ctx: any, owner: { ownerType: 'device' | 'user'; ownerId: string }) {
  const existing = await ctx.db
    .query('notificationSettings')
    .withIndex('by_owner', (q: any) =>
      q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
    )
    .first();
  return existing ?? { ...DEFAULT_SETTINGS };
}

export const getSettings = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await loadSettings(ctx, owner);
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
    };
  },
});

export const upsertSettings = mutation({
  args: {
    ...ownerArgs,
    budgetAlertsEnabled: v.boolean(),
    budgetThresholdPct: v.number(),
    receiptAlertsEnabled: v.boolean(),
    creditDueAlertsEnabled: v.boolean(),
    creditDueDaysBefore: v.number(),
    weeklySummaryEnabled: v.boolean(),
    monthlySummaryEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    const threshold = Math.min(Math.max(args.budgetThresholdPct, 0.5), 1);
    const daysBefore = Math.max(0, Math.min(30, args.creditDueDaysBefore));
    const existing = await ctx.db
      .query('notificationSettings')
      .withIndex('by_owner', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .first();

    const payload = {
      budgetAlertsEnabled: args.budgetAlertsEnabled,
      budgetThresholdPct: threshold,
      receiptAlertsEnabled: args.receiptAlertsEnabled,
      creditDueAlertsEnabled: args.creditDueAlertsEnabled,
      creditDueDaysBefore: daysBefore,
      weeklySummaryEnabled: args.weeklySummaryEnabled,
      monthlySummaryEnabled: args.monthlySummaryEnabled,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }

    return await ctx.db.insert('notificationSettings', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      createdAt: now,
      ...payload,
    });
  },
});

export const listCreditCards = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    return ctx.db
      .query('creditCards')
      .withIndex('by_owner', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .collect();
  },
});

export const upsertCreditCard = mutation({
  args: {
    ...ownerArgs,
    cardId: v.optional(v.id('creditCards')),
    name: v.string(),
    dueDate: v.string(),
    minimumPayment: v.optional(v.number()),
    statementBalance: v.optional(v.number()),
    lastStatementDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const now = Date.now();
    const payload = {
      name: args.name.trim(),
      dueDate: args.dueDate.trim(),
      minimumPayment: args.minimumPayment,
      statementBalance: args.statementBalance,
      lastStatementDate: args.lastStatementDate?.trim() || undefined,
      updatedAt: now,
    };

    if (args.cardId) {
      const existing = await ctx.db.get(args.cardId);
      if (!existing || existing.ownerId !== owner.ownerId || existing.ownerType !== owner.ownerType) {
        throw new Error('Not authorized');
      }
      await ctx.db.patch(args.cardId, payload);
      return args.cardId;
    }

    return await ctx.db.insert('creditCards', {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      createdAt: now,
      ...payload,
    });
  },
});

export const deleteCreditCard = mutation({
  args: {
    ...ownerArgs,
    cardId: v.id('creditCards'),
  },
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const existing = await ctx.db.get(args.cardId);
    if (!existing || existing.ownerId !== owner.ownerId || existing.ownerType !== owner.ownerType) {
      throw new Error('Not authorized');
    }
    await ctx.db.delete(args.cardId);
  },
});

export const getAlerts = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const settings = await loadSettings(ctx, owner);

    const planned = await ctx.runQuery(api.dashboard.getPlannedVsActual, {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    });

    const receiptsReviewItems = settings.receiptAlertsEnabled
      ? await ctx.db
          .query('receiptLineItems')
          .filter((q) =>
            q.and(
              q.eq(q.field('ownerType'), owner.ownerType),
              q.eq(q.field('ownerId'), owner.ownerId),
              q.eq(q.field('needsReview'), true)
            )
          )
          .collect()
      : [];

    const receiptsReview = settings.receiptAlertsEnabled
      ? await ctx.db
          .query('receipts')
          .filter((q) =>
            q.and(
              q.eq(q.field('ownerType'), owner.ownerType),
              q.eq(q.field('ownerId'), owner.ownerId),
              q.eq(q.field('needsReview'), true)
            )
          )
          .collect()
      : [];

    const receiptIds = new Set<string>();
    for (const item of receiptsReviewItems) receiptIds.add(String(item.receiptId));
    for (const rec of receiptsReview) receiptIds.add(String(rec._id));

    const creditCards = settings.creditDueAlertsEnabled
      ? await ctx.db
          .query('creditCards')
          .withIndex('by_owner', (q) =>
            q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
          )
          .collect()
      : [];

    const today = formatDate(new Date());
    const upcoming = creditCards
      .map((card) => {
        const daysUntil = diffDays(today, card.dueDate);
        return { card, daysUntil };
      })
      .filter(
        (entry) =>
          entry.daysUntil !== null &&
          entry.daysUntil >= 0 &&
          entry.daysUntil <= settings.creditDueDaysBefore
      )
      .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0))
      .map(({ card, daysUntil }) => ({
        _id: card._id,
        name: card.name,
        dueDate: card.dueDate,
        minimumPayment: card.minimumPayment,
        statementBalance: card.statementBalance,
        daysUntil: daysUntil ?? 0,
      }));

    const budgetAlerts = settings.budgetAlertsEnabled
      ? await ctx.runQuery(api.dashboard.getBudgetAlerts, {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          thresholdPct: settings.budgetThresholdPct,
        })
      : { overBudget: [], thresholdPct: settings.budgetThresholdPct };

    const weekStart = formatDate(getWeekStart());
    const weekEnd = formatDate(addDays(getWeekStart(), 7));

    return {
      settings,
      receipts: {
        enabled: settings.receiptAlertsEnabled,
        reviewItemCount: receiptsReviewItems.length,
        reviewReceiptCount: receiptIds.size,
      },
      creditDue: {
        enabled: settings.creditDueAlertsEnabled,
        daysBefore: settings.creditDueDaysBefore,
        upcoming,
      },
      budget: {
        enabled: settings.budgetAlertsEnabled,
        thresholdPct: settings.budgetThresholdPct,
        overBudget: budgetAlerts.overBudget,
      },
      weeklySummary: {
        enabled: settings.weeklySummaryEnabled,
        planned: planned?.weekly?.planned ?? 0,
        actual: planned?.weekly?.actual ?? 0,
        weekStart,
        weekEnd,
      },
      monthlySummary: {
        enabled: settings.monthlySummaryEnabled,
        planned: planned?.monthly?.planned ?? 0,
        actual: planned?.monthly?.actual ?? 0,
        periodStart: planned?.periodStart,
        periodEnd: planned?.periodEnd,
      },
    };
  },
});
