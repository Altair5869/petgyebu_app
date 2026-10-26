import type { MonthStats } from '@/api/types';
import { CATEGORY_COLORS, summaryCells } from '@/lib/stats';

const base: MonthStats = {
  month: '2026-10',
  budgetAmount: 300000,
  spentAmount: 26000,
  expenseCount: 4,
  usagePercent: 8.6,
  budgetBalanceAmount: 274000,
  categories: [],
};

test('shows count, usage, and remaining budget', () => {
  expect(summaryCells(base)).toEqual([
    { label: '건수', value: '4건' },
    { label: '사용률', value: '8.6%' },
    { label: '남은 예산', value: '274,000원' },
  ]);
});

test('zero balance reads 0원 under 남은 예산', () => {
  expect(summaryCells({ ...base, budgetBalanceAmount: 0 })[2]).toEqual({ label: '남은 예산', value: '0원' });
});

test('negative balance becomes 초과 with the absolute amount', () => {
  expect(summaryCells({ ...base, budgetBalanceAmount: -12000 })[2]).toEqual({ label: '초과', value: '12,000원' });
});

test('missing budget shows 미설정', () => {
  const cells = summaryCells({ ...base, budgetAmount: null, usagePercent: null, budgetBalanceAmount: null });
  expect(cells[1]).toEqual({ label: '사용률', value: '미설정' });
  expect(cells[2]).toEqual({ label: '남은 예산', value: '미설정' });
});

test('whole-number usage drops the decimal', () => {
  expect(summaryCells({ ...base, usagePercent: 70.0 })[1].value).toBe('70%');
});

test('category colors are seven distinct values', () => {
  const values = Object.values(CATEGORY_COLORS);
  expect(Object.keys(CATEGORY_COLORS)).toHaveLength(7);
  expect(new Set(values).size).toBe(7);
});
