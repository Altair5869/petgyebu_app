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

// Fixed per category code so a category keeps its color across months.
export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  FOOD: '#208AEF',
  CAFE: '#F59E0B',
  TRANSPORT: '#10B981',
  SHOPPING: '#EC4899',
  HEALTH: '#EF4444',
  LIVING: '#8B5CF6',
  OTHER: '#94A3B8',
};
