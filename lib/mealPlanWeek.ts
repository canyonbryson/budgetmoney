export const DAY_CODES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type DayCode = (typeof DAY_CODES)[number];

const DAY_TO_JS_INDEX: Record<DayCode, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 0,
};

const JS_INDEX_TO_DAY: DayCode[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dayCodeFromDate(date: Date): DayCode {
  return JS_INDEX_TO_DAY[date.getDay()];
}

export function getWeekStartForDay(referenceDate = new Date(), startDay: DayCode = 'Mon', offset = 0): Date {
  const d = new Date(referenceDate);
  const currentDay = d.getDay();
  const targetDay = DAY_TO_JS_INDEX[startDay];
  const diff = (currentDay - targetDay + 7) % 7;
  d.setDate(d.getDate() - diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getOrderedWeekDays(weekStart: string | Date): DayCode[] {
  const start = typeof weekStart === 'string' ? new Date(`${weekStart}T00:00:00`) : new Date(weekStart);
  const startCode = dayCodeFromDate(start);
  const startIdx = DAY_CODES.indexOf(startCode);
  return [...DAY_CODES.slice(startIdx), ...DAY_CODES.slice(0, startIdx)];
}

export function dayCodeI18nKey(day: DayCode):
  | 'mondayShort'
  | 'tuesdayShort'
  | 'wednesdayShort'
  | 'thursdayShort'
  | 'fridayShort'
  | 'saturdayShort'
  | 'sundayShort' {
  const map: Record<DayCode, ReturnType<typeof dayCodeI18nKey>> = {
    Mon: 'mondayShort',
    Tue: 'tuesdayShort',
    Wed: 'wednesdayShort',
    Thu: 'thursdayShort',
    Fri: 'fridayShort',
    Sat: 'saturdayShort',
    Sun: 'sundayShort',
  };
  return map[day];
}
