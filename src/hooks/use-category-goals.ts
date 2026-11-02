import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { CategoryGoals } from '@/api/types';

// month is the month this state was loaded for.
type GoalsState = { status: 'loading' | 'error' | 'ready'; goals: CategoryGoals | null; month: string | null };

const INITIAL: GoalsState = { status: 'loading', goals: null, month: null };

export type UseCategoryGoals = Omit<GoalsState, 'month'> & { reload: () => void };

export function useCategoryGoals(api: Pick<ApiClient, 'getCategoryGoals'>, month: string): UseCategoryGoals {
  const [state, setState] = useState<GoalsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState({ ...INITIAL, month });
    api.getCategoryGoals(month).then(
      (goals) => {
        if (gen === generation.current) setState({ status: 'ready', goals, month });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', goals: null, month });
      },
    );
  }, [api, month]);

  // Until reload runs for a new month, the last month's result or error must not show as this one's.
  const { month: _loaded, ...rest } = state.month === month ? state : INITIAL;
  return { ...rest, reload };
}
