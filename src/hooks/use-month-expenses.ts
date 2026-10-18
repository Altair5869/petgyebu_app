import { useCallback, useRef, useState } from 'react';

import { ApiError, type ApiClient } from '@/api/client';
import type { Expense } from '@/api/types';

type ListState = {
  status: 'loading' | 'error' | 'ready';
  items: Expense[];
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: boolean;
};

const INITIAL: ListState = { status: 'loading', items: [], nextCursor: null, loadingMore: false, moreError: false };

export type MonthExpenses = Omit<ListState, 'nextCursor'> & {
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
};

export function useMonthExpenses(api: Pick<ApiClient, 'getMonthExpenses'>, month: string): MonthExpenses {
  const [state, setState] = useState<ListState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);
  const inFlight = useRef(false);
  const cursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    function fetchPage(cursor: string | null) {
      const gen = generation.current;
      inFlight.current = true;
      api.getMonthExpenses(month, cursor ?? undefined).then(
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
          setState((s) => (cursor ? { ...s, loadingMore: false, moreError: true } : { ...INITIAL, status: 'error' }));
        },
      );
    },
    [api, month],
  );

  const reload = useCallback(() => {
    generation.current += 1;
    cursorRef.current = null;
    setState(INITIAL);
    fetchPage(null);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor || inFlight.current) return;
    setState((s) => ({ ...s, loadingMore: true, moreError: false }));
    fetchPage(cursor);
  }, [fetchPage]);

  const { nextCursor, ...rest } = state;
  return { ...rest, hasMore: nextCursor !== null, reload, loadMore };
}
