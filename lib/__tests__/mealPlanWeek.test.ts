import {
  getOrderedWeekDays,
  getWeekStartForDay,
  formatIsoDate,
  type DayCode,
} from '@/lib/mealPlanWeek';

describe('mealPlanWeek', () => {
  it('computes week start for a custom start day', () => {
    const reference = new Date('2026-02-12T12:00:00.000Z'); // Thu
    const start = getWeekStartForDay(reference, 'Wed');
    expect(formatIsoDate(start)).toBe('2026-02-11');
  });

  it('applies week offset from the computed week start', () => {
    const reference = new Date('2026-02-12T12:00:00.000Z'); // Thu
    const start = getWeekStartForDay(reference, 'Wed', 1);
    expect(formatIsoDate(start)).toBe('2026-02-18');
  });

  it('orders day codes from the provided week start', () => {
    const ordered = getOrderedWeekDays('2026-02-11');
    const expected: DayCode[] = ['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];
    expect(ordered).toEqual(expected);
  });
});
