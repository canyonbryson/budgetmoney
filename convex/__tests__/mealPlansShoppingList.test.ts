import { resolveShoppingWeekStart } from '../mealPlans';

describe('resolveShoppingWeekStart', () => {
  it('returns explicit weekStart when provided', () => {
    expect(resolveShoppingWeekStart('2026-02-09')).toBe('2026-02-09');
  });

  it('returns an ISO date for the current week when omitted', () => {
    const result = resolveShoppingWeekStart();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('does not change an explicit mid-week anchor', () => {
    expect(resolveShoppingWeekStart('2026-02-12')).toBe('2026-02-12');
  });
});
