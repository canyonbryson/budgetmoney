import { query } from './_generated/server';
import { ownerArgs, resolveOwner } from './ownership';

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7);
}

export const getTrends = query({
  args: ownerArgs,
  handler: async (ctx, args) => {
    const owner = await resolveOwner(ctx, args);
    const transactions = await ctx.db
      .query('transactions')
      .withIndex('by_owner_date', (q) =>
        q.eq('ownerType', owner.ownerType).eq('ownerId', owner.ownerId)
      )
      .order('desc')
      .take(500);

    const totals = new Map<string, number>();
    for (const tx of transactions) {
      const key = monthKey(tx.date);
      totals.set(key, (totals.get(key) ?? 0) + tx.amount);
    }

    const monthlyTotals = Array.from(totals.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 6)
      .map(([month, total]) => ({ month, total }));

    return { monthlyTotals };
  },
});

