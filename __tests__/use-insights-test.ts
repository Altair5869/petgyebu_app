import { act, renderHook } from '@testing-library/react-native';

import type { Insights } from '@/api/types';
import { useInsights } from '@/hooks/use-insights';

function insights(spent: number): Insights {
  return { spent } as unknown as Insights;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test('does not fetch until reload, then becomes ready', async () => {
  const get = jest.fn().mockResolvedValue(insights(1));
  const { result } = await renderHook(() => useInsights({ getInsights: get }));
  expect(get).not.toHaveBeenCalled();
  expect(result.current.status).toBe('loading');

  await act(async () => result.current.reload());

  expect(result.current.status).toBe('ready');
  expect(result.current.insights).toEqual(insights(1));
});

test('reports an error with no insights and recovers on reload', async () => {
  const get = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(insights(2));
  const { result } = await renderHook(() => useInsights({ getInsights: get }));

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('error');
  expect(result.current.insights).toBeNull();

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
});

test('ignores a late response from an earlier reload', async () => {
  const first = deferred<Insights>();
  const get = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(insights(2));
  const { result } = await renderHook(() => useInsights({ getInsights: get }));

  await act(async () => result.current.reload());
  await act(async () => result.current.reload());
  await act(async () => first.resolve(insights(1)));

  expect(result.current.insights).toEqual(insights(2));
});

test('reload is stable while api is unchanged', async () => {
  const api = { getInsights: jest.fn().mockResolvedValue(insights(1)) };
  const { result, rerender } = await renderHook(() => useInsights(api));
  const first = result.current.reload;
  await rerender({});
  expect(result.current.reload).toBe(first);
});
