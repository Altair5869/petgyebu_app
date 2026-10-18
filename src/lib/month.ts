// Asia/Seoul is UTC+9 with no daylight saving time.
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

function toMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function currentMonth(now: Date = new Date()): string {
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_MS);
  return toMonth(seoul.getUTCFullYear(), seoul.getUTCMonth() + 1);
}

export function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? toMonth(year - 1, 12) : toMonth(year, m - 1);
}

export function monthTitle(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year}년 ${m}월`;
}
