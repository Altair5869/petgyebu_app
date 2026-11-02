import { act, renderHook } from '@testing-library/react-native';

import { useCategoryGoals } from '@/hooks/use-category-goals';
import { useDailyTotals } from '@/hooks/use-daily-totals';
import { useMonthStats } from '@/hooks/use-month-stats';

const fail = () => Promise.reject(new TypeError('Network request failed'));

// The screen reloads in an effect after the month changes; the render before it must not show the old error.
test.each([
  ['useMonthStats', (month: string) => useMonthStats({ getMonthStats: fail }, month)],
  ['useCategoryGoals', (month: string) => useCategoryGoals({ getCategoryGoals: fail }, month)],
  ['useDailyTotals', (month: string) => useDailyTotals({ getDailyTotals: fail }, month)],
])('%s does not carry an error into another month', async (_name, useHook) => {
  const { result, rerender } = await renderHook(({ month }: { month: string }) => useHook(month), {
    initialProps: { month: '2026-09' },
  });
  await act(async () => result.current.reload());
  expect(result.current.status).toBe('error');

  await rerender({ month: '2026-08' });
  expect(result.current.status).toBe('loading');
});
