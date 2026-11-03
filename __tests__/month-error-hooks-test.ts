import { act, renderHook } from '@testing-library/react-native';

import type { CategoryGoals, DailyTotals } from '@/api/types';

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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const goals = (month: string, goalTotalAmount: number) => ({ month, goalTotalAmount }) as unknown as CategoryGoals;
const totals = (month: string, spentAmount: number) =>
  ({ month, days: [{ date: `${month}-01`, spentAmount }] }) as unknown as DailyTotals;

// Returning to the stats screen reloads the same month; the loaded data stays until the response.
test.each([
  ['useCategoryGoals', 'goals', (get: jest.Mock) => useCategoryGoals({ getCategoryGoals: get }, '2026-10'), goals],
  ['useDailyTotals', 'totals', (get: jest.Mock) => useDailyTotals({ getDailyTotals: get }, '2026-10'), totals],
] as const)('%s keeps the loaded month while reloading it', async (_name, key, useHook, make) => {
  const second = deferred<unknown>();
  const get = jest.fn().mockResolvedValueOnce(make('2026-10', 1)).mockReturnValueOnce(second.promise);
  const { result } = await renderHook(() => useHook(get));
  await act(async () => result.current.reload());

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
  expect((result.current as Record<string, unknown>)[key]).toEqual(make('2026-10', 1));

  await act(async () => second.resolve(make('2026-10', 2)));
  expect((result.current as Record<string, unknown>)[key]).toEqual(make('2026-10', 2));
});
