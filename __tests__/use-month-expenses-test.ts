import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import type { Expense, ExpensePage } from '@/api/types';
import { useMonthExpenses } from '@/hooks/use-month-expenses';

function expense(id: number): Expense {
  return { id, amount: 1000, expenseDate: '2026-10-17', category: 'OTHER', memo: null };
}

function page(ids: number[], nextCursor: string | null): ExpensePage {
  return { items: ids.map(expense), nextCursor };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function setup(getMonthExpenses: jest.Mock) {
  const api = { getMonthExpenses };
  const hook = await renderHook(() => useMonthExpenses(api, '2026-10'));
  return hook;
}

async function setupWithCategory(getMonthExpenses: jest.Mock) {
  const api = { getMonthExpenses };
  return renderHook(() => useMonthExpenses(api, '2026-09', 'CAFE'));
}

async function flush() {
  await act(async () => {});
}

test('loads the first page and appends the next one', async () => {
  const get = jest.fn().mockResolvedValueOnce(page([3, 2], 'c1')).mockResolvedValueOnce(page([1], null));
  const { result } = await setup(get);

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2]);
  expect(result.current.hasMore).toBe(true);

  await act(async () => result.current.loadMore());
  expect(get).toHaveBeenLastCalledWith('2026-10', 'c1');
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
  expect(result.current.hasMore).toBe(false);
});

test('does not request past the last page or on an empty list', async () => {
  const get = jest.fn().mockResolvedValue(page([], null));
  const { result } = await setup(get);

  await act(async () => result.current.reload());
  await act(async () => result.current.loadMore());

  expect(get).toHaveBeenCalledTimes(1);
});

test('sends one request when loadMore fires twice', async () => {
  const next = deferred<ExpensePage>();
  const get = jest.fn().mockResolvedValueOnce(page([3, 2], 'c1')).mockReturnValueOnce(next.promise);
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  await act(async () => {
    result.current.loadMore();
    result.current.loadMore();
  });
  expect(get).toHaveBeenCalledTimes(2);
  expect(result.current.loadingMore).toBe(true);

  await act(async () => next.resolve(page([1], null)));
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
});

test('keeps items when loading more fails and retries the same cursor without duplicates', async () => {
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([3, 2], 'c1'))
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(page([1], null));
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  await act(async () => result.current.loadMore());
  expect(result.current.moreError).toBe(true);
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2]);

  await act(async () => result.current.loadMore());
  expect(get).toHaveBeenLastCalledWith('2026-10', 'c1');
  expect(result.current.moreError).toBe(false);
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
});

test('reports an error when the first page fails and recovers on reload', async () => {
  const get = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(page([1], null));
  const { result } = await setup(get);

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('error');

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
});

test('reload drops the cursor and ignores a late page from before the reload', async () => {
  const late = deferred<ExpensePage>();
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([3, 2], 'c1'))
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce(page([4, 3, 2], 'c2'));
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  await act(async () => result.current.loadMore());
  await act(async () => result.current.reload());
  expect(get).toHaveBeenLastCalledWith('2026-10', undefined);

  await act(async () => late.resolve(page([1], null)));
  await flush();
  expect(result.current.items.map((e) => e.id)).toEqual([4, 3, 2]);
  expect(result.current.hasMore).toBe(true);
});

test('starts over from the first page on INVALID_CURSOR', async () => {
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([3, 2], 'c1'))
    .mockRejectedValueOnce(new ApiError(400, 'INVALID_CURSOR'))
    .mockResolvedValueOnce(page([3, 2, 1], null));
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  await act(async () => result.current.loadMore());
  await flush();

  expect(get).toHaveBeenLastCalledWith('2026-10', undefined);
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
});

test('sends the category with the first page and with the cursor', async () => {
  const get = jest.fn().mockResolvedValueOnce(page([2], 'n1')).mockResolvedValueOnce(page([1], null));
  const { result } = await setupWithCategory(get);

  await act(async () => result.current.reload());
  expect(get).toHaveBeenLastCalledWith('2026-09', undefined, 'CAFE');

  await act(async () => result.current.loadMore());
  expect(get).toHaveBeenLastCalledWith('2026-09', 'n1', 'CAFE');
});

test('keeps the category when restarting after INVALID_CURSOR', async () => {
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([2], 'n1'))
    .mockRejectedValueOnce(new ApiError(400, 'INVALID_CURSOR'))
    .mockResolvedValueOnce(page([2, 1], null));
  const { result } = await setupWithCategory(get);
  await act(async () => result.current.reload());

  await act(async () => result.current.loadMore());
  await flush();

  expect(get).toHaveBeenLastCalledWith('2026-09', undefined, 'CAFE');
});

test('sends the day with the first page and with the cursor', async () => {
  const get = jest.fn().mockResolvedValueOnce(page([2], 'n1')).mockResolvedValueOnce(page([1], null));
  const { result } = await renderHook(() => useMonthExpenses({ getMonthExpenses: get }, '2026-10', undefined, '2026-10-17'));

  await act(async () => result.current.reload());
  expect(get).toHaveBeenLastCalledWith('2026-10', undefined, undefined, '2026-10-17');

  await act(async () => result.current.loadMore());
  expect(get).toHaveBeenLastCalledWith('2026-10', 'n1', undefined, '2026-10-17');
});

test('items loaded for one day are not shown for the next before it reloads', async () => {
  const get = jest.fn().mockResolvedValue(page([2], null));
  const { result, rerender } = await renderHook(
    ({ date }: { date: string }) => useMonthExpenses({ getMonthExpenses: get }, '2026-10', undefined, date),
    { initialProps: { date: '2026-10-17' } },
  );
  await act(async () => result.current.reload());
  expect(result.current.items).toHaveLength(1);

  await rerender({ date: '2026-10-18' });

  expect(result.current.status).toBe('loading');
  expect(result.current.items).toEqual([]);
});
