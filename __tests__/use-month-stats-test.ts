import { act, renderHook } from '@testing-library/react-native';

import type { MonthStats } from '@/api/types';
import { useMonthStats } from '@/hooks/use-month-stats';

function stats(month: string): MonthStats {
  return { month, budgetAmount: 100000, spentAmount: 1000, expenseCount: 1, usagePercent: 1, budgetBalanceAmount: 99000, categories: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test('loads the month stats on reload', async () => {
  const get = jest.fn().mockResolvedValue(stats('2026-10'));
  const { result } = await renderHook(() => useMonthStats({ getMonthStats: get }, '2026-10'));

  await act(async () => result.current.reload());

  expect(get).toHaveBeenCalledWith('2026-10');
  expect(result.current.status).toBe('ready');
  expect(result.current.stats).toEqual(stats('2026-10'));
});

test('reports an error and recovers on reload', async () => {
  const get = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(stats('2026-10'));
  const { result } = await renderHook(() => useMonthStats({ getMonthStats: get }, '2026-10'));

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('error');

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
});

test('reload clears previous stats immediately', async () => {
  const second = deferred<MonthStats>();
  const get = jest.fn().mockResolvedValueOnce(stats('2026-10')).mockReturnValueOnce(second.promise);
  const { result } = await renderHook(() => useMonthStats({ getMonthStats: get }, '2026-10'));
  await act(async () => result.current.reload());

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('loading');
  expect(result.current.stats).toBeNull();

  await act(async () => second.resolve(stats('2026-10')));
  expect(result.current.status).toBe('ready');
});

test('ignores a late response from the previous month', async () => {
  const sep = deferred<MonthStats>();
  const get = jest.fn().mockReturnValueOnce(sep.promise).mockResolvedValueOnce(stats('2026-08'));
  const api = { getMonthStats: get };
  const { result, rerender } = await renderHook(({ month }: { month: string }) => useMonthStats(api, month), {
    initialProps: { month: '2026-09' },
  });
  await act(async () => result.current.reload());

  await rerender({ month: '2026-08' });
  await act(async () => result.current.reload());
  expect(get).toHaveBeenLastCalledWith('2026-08');

  await act(async () => sep.resolve(stats('2026-09')));
  expect(result.current.stats).toEqual(stats('2026-08'));
});
