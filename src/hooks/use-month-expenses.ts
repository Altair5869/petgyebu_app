import { useCallback, useRef, useState } from 'react';

import { ApiError, type ApiClient } from '@/api/client';
import type { Expense, ExpenseCategory } from '@/api/types';

type ListState = {
  status: 'loading' | 'error' | 'ready';
  items: Expense[];
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: boolean;
  // The month/category/date this state was loaded for.
  query: string | null;
};

const INITIAL: ListState = { status: 'loading', items: [], nextCursor: null, loadingMore: false, moreError: false, query: null };

export type MonthExpenses = Omit<ListState, 'nextCursor' | 'query'> & {
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
};

export function useMonthExpenses(api: Pick<ApiClient, 'getMonthExpenses'>,
  month: string,
  category?: ExpenseCategory,
  // One day of the month (YYYY-MM-DD) for the calendar.
  date?: string,
): MonthExpenses {
  const query = `${month}|${category ?? ''}|${date ?? ''}`;
  const [state, setState] = useState<ListState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);
  const inFlight = useRef(false);
  const cursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    function fetchPage(cursor: string | null) {
      const gen = generation.current;
      inFlight.current = true;
      // Without a filter keep the two-argument call shape.
      const request = category
        ? api.getMonthExpenses(month, cursor ?? undefined, category)
        : date
          ? api.getMonthExpenses(month, cursor ?? undefined, undefined, date)
          : api.getMonthExpenses(month, cursor ?? undefined);
      request.then(
        (page) => {
          if (gen !== generation.current) return;
          inFlight.current = false;
          cursorRef.current = page.nextCursor;
          setState((s) => ({
            status: 'ready',
            items: cursor ? [...s.items, ...page.items] : page.items,
            nextCursor: page.nextCursor,
            loadingMore: false,
            moreError: false,
            query: s.query,
          }));
        },
        (error: unknown) => {
          if (gen !== generation.current) return;
          inFlight.current = false;
          if (cursor && error instanceof ApiError && error.code === 'INVALID_CURSOR') {
            generation.current += 1;
            cursorRef.current = null;
            fetchPage(null);
            return;
          }
          setState((s) => (cursor ? { ...s, loadingMore: false, moreError: true } : { ...INITIAL, status: 'error', query: s.query }));
        },
      );
    },
    [api, month, category, date],
  );

  const reload = useCallback(() => {
    generation.current += 1;
    cursorRef.current = null;
    setState({ ...INITIAL, query });
    fetchPage(null);
  }, [fetchPage, query]);

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor || inFlight.current) return;
    setState((s) => ({ ...s, loadingMore: true, moreError: false }));
    fetchPage(cursor);
  }, [fetchPage]);

  // Until reload runs for a new month, category or date, the old items must not show as this one's.
  const { nextCursor, ...rest } = state.query === query ? state : INITIAL;
  return { ...rest, hasMore: nextCursor !== null, reload, loadMore };
}
