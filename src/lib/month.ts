// Asia/Seoul is UTC+9 with no daylight saving time.
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

function toMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function currentMonth(now: Date = new Date()): string {
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_MS);
  return toMonth(seoul.getUTCFullYear(), seoul.getUTCMonth() + 1);
}

export function dateToSeoulDay(date: Date): string {
  const seoul = new Date(date.getTime() + SEOUL_OFFSET_MS);
  const day = String(seoul.getUTCDate()).padStart(2, '0');
  return `${toMonth(seoul.getUTCFullYear(), seoul.getUTCMonth() + 1)}-${day}`;
}

export function todayInSeoul(now: Date = new Date()): string {
  return dateToSeoulDay(now);
}

// Noon keeps the same calendar day for any picker time zone rounding.
export function seoulDayToDate(day: string): Date {
  return new Date(`${day}T12:00:00+09:00`);
}

export function formatDay(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return `${month}월 ${date}일`;
}

export function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? toMonth(year - 1, 12) : toMonth(year, m - 1);
}

export function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 12 ? toMonth(year + 1, 1) : toMonth(year, m + 1);
}

// The product covers 2000-01 onward; YYYY-MM strings compare chronologically.
const EARLIEST_MONTH = '2000-01';

export function canGoToPreviousMonth(month: string): boolean {
  return month > EARLIEST_MONTH;
}

// Future months are never reachable: the latest month is the current Seoul month.
export function canGoToNextMonth(month: string, now: Date = new Date()): boolean {
  return month < currentMonth(now);
}

export function monthTitle(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year}년 ${m}월`;
}
