import { act, renderHook } from '@testing-library/react-native';

import type { CategoryGoals } from '@/api/types';
import { useCategoryGoals } from '@/hooks/use-category-goals';

function goals(month: string): CategoryGoals {
  return { month, budgetAmount: 100000, goalTotalAmount: 0, goalsExceedBudget: false, goals: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test('loads the category goals on reload', async () => {
  const get = jest.fn().mockResolvedValue(goals('2026-10'));
  const { result } = await renderHook(() => useCategoryGoals({ getCategoryGoals: get }, '2026-10'));
  expect(get).not.toHaveBeenCalled();

  await act(async () => result.current.reload());

  expect(get).toHaveBeenCalledWith('2026-10');
  expect(result.current.status).toBe('ready');
  expect(result.current.goals).toEqual(goals('2026-10'));
});

test('reports an error and recovers on reload', async () => {
  const get = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(goals('2026-10'));
  const { result } = await renderHook(() => useCategoryGoals({ getCategoryGoals: get }, '2026-10'));

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('error');
  expect(result.current.goals).toBeNull();

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
});

test('ignores a late response from an earlier reload', async () => {
  const first = deferred<CategoryGoals>();
  const get = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(goals('2026-10'));
  const { result } = await renderHook(() => useCategoryGoals({ getCategoryGoals: get }, '2026-10'));

  await act(async () => result.current.reload());
  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');

  await act(async () => first.resolve({ ...goals('2026-10'), budgetAmount: 1 }));
  expect(result.current.goals).toEqual(goals('2026-10'));
});
