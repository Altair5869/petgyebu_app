import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { DailyTotals } from '@/api/types';

type TotalsState = { status: 'loading' | 'error' | 'ready'; totals: DailyTotals | null };

const INITIAL: TotalsState = { status: 'loading', totals: null };

export type UseDailyTotals = TotalsState & { reload: () => void };

export function useDailyTotals(api: Pick<ApiClient, 'getDailyTotals'>, month: string): UseDailyTotals {
  const [state, setState] = useState<TotalsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState(INITIAL);
    api.getDailyTotals(month).then(
      (totals) => {
        if (gen === generation.current) setState({ status: 'ready', totals });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', totals: null });
      },
    );
  }, [api, month]);

  return { ...state, reload };
}
