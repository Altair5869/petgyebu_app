import { currentMonth, todayInSeoul } from '@/lib/month';

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

// Sunday-first weeks: null fills the days before the 1st and after the last day.
export function calendarCells(month: string): (string | null)[] {
  const [year, m] = month.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(year, m - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let date = 1; date <= lastDate; date += 1) cells.push(`${month}-${String(date).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Today in the current month, otherwise the 1st.
export function initialSelectedDay(month: string, now: Date = new Date()): string {
  return month === currentMonth(now) ? todayInSeoul(now) : `${month}-01`;
}

// Short day total for a calendar cell. Rounds down, like the usage percent; the card shows the exact amount.
export function formatDayAmount(amount: number): string {
  if (amount < 1_000) return String(amount);
  if (amount < 10_000) return `${Math.floor(amount / 1_000)}천`;
  if (amount < 100_000_000) return `${Math.floor(amount / 1_000) / 10}만`;
  return `${Math.floor(amount / 10_000_000) / 10}억`;
}
