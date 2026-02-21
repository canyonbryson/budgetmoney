export function formatPeriodDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getPeriodForOffset(
  anchorDate: string,
  cycleLengthDays: number,
  now: Date,
  offset = 0
) {
  const anchor = new Date(anchorDate);
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((now.getTime() - anchor.getTime()) / msPerDay);
  const periods = Math.floor(Math.max(diffDays, 0) / cycleLengthDays) + offset;
  const periodStart = new Date(anchor.getTime() + periods * cycleLengthDays * msPerDay);
  const periodEnd = new Date(periodStart.getTime() + cycleLengthDays * msPerDay);
  return { periodStart: formatPeriodDate(periodStart), periodEnd: formatPeriodDate(periodEnd) };
}

export function getCurrentPeriod(anchorDate: string, cycleLengthDays: number, now: Date) {
  return getPeriodForOffset(anchorDate, cycleLengthDays, now, 0);
}
