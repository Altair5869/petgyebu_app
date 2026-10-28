import { useCallback, useRef, useState } from 'react';

import type { ApiClient } from '@/api/client';
import type { Insights } from '@/api/types';

type InsightsState = { status: 'loading' | 'error' | 'ready'; insights: Insights | null };

const INITIAL: InsightsState = { status: 'loading', insights: null };

export type UseInsights = InsightsState & { reload: () => void };

export function useInsights(api: Pick<ApiClient, 'getInsights'>): UseInsights {
  const [state, setState] = useState<InsightsState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);

  const reload = useCallback(() => {
    generation.current += 1;
    const gen = generation.current;
    setState(INITIAL);
    api.getInsights().then(
      (insights) => {
        if (gen === generation.current) setState({ status: 'ready', insights });
      },
      () => {
        if (gen === generation.current) setState({ status: 'error', insights: null });
      },
    );
  }, [api]);

  return { ...state, reload };
}
