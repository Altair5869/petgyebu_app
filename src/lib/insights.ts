import type { DayRange, Forecast, WeeklyCategoryChange } from '@/api/types';
import { CATEGORY_LABELS } from '@/lib/expense';
import { formatNumber, formatWon } from '@/lib/money';
import { formatDay } from '@/lib/month';

export type ForecastCopy = { title: string; detail: string | null };

// Returns null when the card should be hidden: an unknown status or a missing exhaustion date.
export function forecastCopy(forecast: Forecast): ForecastCopy | null {
  const detail =
    forecast.dailyAverageAmount === null ? null : `하루 평균 ${formatWon(forecast.dailyAverageAmount)}`;
  switch (forecast.status) {
    case 'WILL_EXHAUST':
      if (forecast.exhaustionDate === null) return null;
      return { title: `이 속도면 ${formatDay(forecast.exhaustionDate)}에 예산을 다 써요`, detail };
    case 'WITHIN_BUDGET':
      return { title: '이 속도면 이번 달 예산 안에서 지낼 수 있어요', detail };
    case 'BUDGET_REACHED':
      return { title: '이번 달 예산을 모두 썼어요', detail };
    case 'TOO_EARLY':
      return { title: '4일부터 이번 달 예측을 보여 드려요', detail };
    case 'NO_BUDGET':
      return { title: '이번 달 예산이 없어 예측할 수 없어요', detail };
    default:
      return null;
  }
}

export type WeeklyHeadline =
  | { kind: 'increased'; categoryLabel: string; amountText: string }
  | { kind: 'noIncrease' }
  | { kind: 'empty' };

// The server sorts categories by change, so only the first row can be the largest increase.
export function weeklyHeadline(categories: WeeklyCategoryChange[]): WeeklyHeadline {
  const top = categories[0];
  if (!top) return { kind: 'empty' };
  if (top.changeAmount <= 0) return { kind: 'noIncrease' };
  return { kind: 'increased', categoryLabel: CATEGORY_LABELS[top.category], amountText: formatWon(top.changeAmount) };
}

export function formatDayRange(range: DayRange): string {
  if (range.from === range.to) return formatDay(range.from);
  const sameMonth = range.from.slice(0, 7) === range.to.slice(0, 7);
  const end = sameMonth ? `${Number(range.to.slice(8))}일` : formatDay(range.to);
  return `${formatDay(range.from)}~${end}`;
}

export function formatWeekRanges(thisWeek: DayRange, lastWeek: DayRange): string {
  return `${formatDayRange(thisWeek)} vs ${formatDayRange(lastWeek)}`;
}

export type ChangeTone = 'up' | 'down' | 'none';

export function changeTone(changeAmount: number): ChangeTone {
  if (changeAmount > 0) return 'up';
  if (changeAmount < 0) return 'down';
  return 'none';
}

// Negative amounts use U+2212 MINUS SIGN.
export function formatChange(changeAmount: number): string {
  if (changeAmount > 0) return `+${formatNumber(changeAmount)}`;
  if (changeAmount < 0) return `−${formatNumber(-changeAmount)}`;
  return '0';
}

export function maxWeeklyAmount(categories: WeeklyCategoryChange[]): number {
  return categories.reduce((max, c) => Math.max(max, c.thisWeekAmount, c.lastWeekAmount), 0);
}

export function barPercent(amount: number, max: number): number {
  return max > 0 ? (amount / max) * 100 : 0;
}

export function changeRowLabel(change: WeeklyCategoryChange): string {
  const base = `${CATEGORY_LABELS[change.category]}, 이번 주 ${formatWon(change.thisWeekAmount)}, 지난주 ${formatWon(change.lastWeekAmount)}`;
  const tone = changeTone(change.changeAmount);
  if (tone === 'up') return `${base}, ${formatWon(change.changeAmount)} 늘었어요`;
  if (tone === 'down') return `${base}, ${formatWon(-change.changeAmount)} 줄었어요`;
  return `${base}, 변화 없어요`;
}
