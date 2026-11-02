import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { DailyTotals } from '@/api/types';

// month is the month this state was loaded for.
type TotalsState = { status: 'loading' | 'error' | 'ready'; totals: DailyTotals | null; month: string | null };

const INITIAL: TotalsState = { status: 'loading', totals: null, month: null };

export type UseDailyTotals = Omit<TotalsState, 'month'> & { reload: () => void };

export function useDailyTotals(api: Pick<ApiClient, 'getDailyTotals'>, month: string): UseDailyTotals {
  const [state, setState] = useState<TotalsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState({ ...INITIAL, month });
    api.getDailyTotals(month).then(
      (totals) => {
        if (gen === generation.current) setState({ status: 'ready', totals, month });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', totals: null, month });
      },
    );
  }, [api, month]);

  // Until reload runs for a new month, the last month's result or error must not show as this one's.
  const { month: _loaded, ...rest } = state.month === month ? state : INITIAL;
  return { ...rest, reload };
}
