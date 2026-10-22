import type { ExpenseCategory, MonthStats } from '@/api/types';
import { formatUsagePercent, formatWon } from '@/lib/money';

export type SummaryCell = { label: string; value: string };

const NOT_SET = '미설정';

export function summaryCells(stats: MonthStats): [SummaryCell, SummaryCell, SummaryCell] {
  const { budgetBalanceAmount: balance, usagePercent } = stats;
  let remaining: SummaryCell;
  if (balance === null) remaining = { label: '남은 예산', value: NOT_SET };
  else if (balance < 0) remaining = { label: '초과', value: formatWon(-balance) };
  else remaining = { label: '남은 예산', value: formatWon(balance) };

  return [
    { label: '건수', value: `${stats.expenseCount}건` },
    { label: '사용률', value: usagePercent === null ? NOT_SET : formatUsagePercent(usagePercent) },
    remaining,
  ];
}

// Warm, light accents on cream/white surfaces; labels and values remain dark for readability.
// Fixed per category code so a category keeps its color across months.
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  FOOD: '#E9A06D',
  CAFE: '#D6B458',
  TRANSPORT: '#7EB8C6',
  SHOPPING: '#E8A0AE',
  HEALTH: '#9EBB81',
  LIVING: '#B4A1D4',
  OTHER: '#C6B39C',
};
