import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { MonthStats } from '@/api/types';

// month is the month this state was loaded for.
type StatsState = { status: 'loading' | 'error' | 'ready'; stats: MonthStats | null; month: string | null };

const INITIAL: StatsState = { status: 'loading', stats: null, month: null };

export type UseMonthStats = Omit<StatsState, 'month'> & { reload: () => void };

export function useMonthStats(api: Pick<ApiClient, 'getMonthStats'>, month: string): UseMonthStats {
  const [state, setState] = useState<StatsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState({ ...INITIAL, month });
    api.getMonthStats(month).then(
      (stats) => {
        if (gen === generation.current) setState({ status: 'ready', stats, month });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', stats: null, month });
      },
    );
  }, [api, month]);

  // Until reload runs for a new month, the last month's result or error must not show as this one's.
  const { month: _loaded, ...rest } = state.month === month ? state : INITIAL;
  return { ...rest, reload };
}
