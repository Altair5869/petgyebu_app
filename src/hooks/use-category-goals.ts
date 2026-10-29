import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { CategoryGoals } from '@/api/types';

type GoalsState = { status: 'loading' | 'error' | 'ready'; goals: CategoryGoals | null };

const INITIAL: GoalsState = { status: 'loading', goals: null };

export type UseCategoryGoals = GoalsState & { reload: () => void };

export function useCategoryGoals(api: Pick<ApiClient, 'getCategoryGoals'>, month: string): UseCategoryGoals {
  const [state, setState] = useState<GoalsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState(INITIAL);
    api.getCategoryGoals(month).then(
      (goals) => {
        if (gen === generation.current) setState({ status: 'ready', goals });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', goals: null });
      },
    );
  }, [api, month]);

  return { ...state, reload };
}
