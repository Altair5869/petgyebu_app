import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { MonthStats } from '@/api/types';

type StatsState = { status: 'loading' | 'error' | 'ready'; stats: MonthStats | null };

const INITIAL: StatsState = { status: 'loading', stats: null };

export type UseMonthStats = StatsState & { reload: () => void };

export function useMonthStats(api: Pick<ApiClient, 'getMonthStats'>, month: string): UseMonthStats {
  const [state, setState] = useState<StatsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState(INITIAL);
    api.getMonthStats(month).then(
      (stats) => {
        if (gen === generation.current) setState({ status: 'ready', stats });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', stats: null });
      },
    );
  }, [api, month]);

  return { ...state, reload };
}
