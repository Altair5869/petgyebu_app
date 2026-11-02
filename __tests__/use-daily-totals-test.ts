import { act, renderHook } from '@testing-library/react-native';

import type { DailyTotals } from '@/api/types';
import { useDailyTotals } from '@/hooks/use-daily-totals';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function totals(month: string, spentAmount: number): DailyTotals {
  return { month, days: [{ date: `${month}-01`, spentAmount, expenseCount: 1 }] };
}

test('a late response for the previous month never shows after the next month has loaded', async () => {
  const monthA = deferred<DailyTotals>();
  const monthB = deferred<DailyTotals>();
  const get = jest.fn().mockReturnValueOnce(monthA.promise).mockReturnValueOnce(monthB.promise);
  const { result, rerender } = await renderHook(
    ({ month }: { month: string }) => useDailyTotals({ getDailyTotals: get }, month),
    { initialProps: { month: '2026-09' } },
  );
  await act(async () => result.current.reload());

  await rerender({ month: '2026-10' });
  await act(async () => result.current.reload());
  expect(get).toHaveBeenLastCalledWith('2026-10');

  await act(async () => monthB.resolve(totals('2026-10', 2000)));
  expect(result.current.totals).toEqual(totals('2026-10', 2000));

  await act(async () => monthA.resolve(totals('2026-09', 1000)));
  await act(async () => {});
  expect(result.current.status).toBe('ready');
  expect(result.current.totals).toEqual(totals('2026-10', 2000));
});
