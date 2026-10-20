import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { ApiError, createApiClient, type ApiClient, type TokenStore } from '@/api/client';
import type { Me, Provider } from '@/api/types';
import { currentMonth } from '@/lib/month';
import { resolveStage, type Stage } from '@/lib/onboarding-stage';

import { getSocialCredential, signOutSocial, unlinkSocial } from './social-credential';
import { secureTokenStore } from './token-store';

export type SessionState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; stage: Stage };

type SessionContextValue = {
  state: SessionState;
  api: ApiClient;
  signIn: (provider: Provider) => Promise<void>;
  refreshStage: () => Promise<void>;
  signOut: (provider: Me['provider']) => Promise<void>;
  deleteAccount: (provider: Me['provider']) => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

async function loadStage(api: ApiClient): Promise<Stage> {
  const me = await api.getMe();
  if (me.petType === null) return resolveStage(null, null);
  const budget = await api.getBudget(currentMonth());
  return resolveStage(me.petType, budget.amount);
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function toProvider(provider: Me['provider']): Provider {
  return provider === 'KAKAO' ? 'kakao' : 'google';
}

type SessionProviderProps = PropsWithChildren<{ baseUrl: string; tokenStore?: TokenStore }>;

export function SessionProvider({ baseUrl, tokenStore = secureTokenStore, children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [api] = useState(() =>
    createApiClient({ baseUrl, tokenStore, onSessionExpired: () => setState({ status: 'signedOut' }) }),
  );
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const restored = await api.restoreSession();
        const next: SessionState = restored ? { status: 'signedIn', stage: await loadStage(api) } : { status: 'signedOut' };
        if (active) setState(next);
      } catch (error) {
        if (active) setState(isUnauthorized(error) ? { status: 'signedOut' } : { status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [api, bootAttempt]);

  const signIn = useCallback(
    async (provider: Provider) => {
      const credential = await getSocialCredential(provider);
      await api.login(provider, credential);
      setState({ status: 'signedIn', stage: await loadStage(api) });
    },
    [api],
  );

  const refreshStage = useCallback(async () => {
    setState({ status: 'signedIn', stage: await loadStage(api) });
  }, [api]);

  const signOut = useCallback(
    async (provider: Me['provider']) => {
      try {
        await api.logout();
      } finally {
        // The native SDK may hang, so it must not hold up the state change.
        void signOutSocial(toProvider(provider));
        setState({ status: 'signedOut' });
      }
    },
    [api],
  );

  const deleteAccount = useCallback(
    async (provider: Me['provider']) => {
      try {
        await api.deleteMe();
      } catch (error) {
        if (!isUnauthorized(error)) throw error;
        // The session is gone and cannot be refreshed; end it locally instead of failing silently.
        await api.logout();
        setState({ status: 'signedOut' });
        return;
      }
      void unlinkSocial(toProvider(provider));
      setState({ status: 'signedOut' });
    },
    [api],
  );

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setBootAttempt((n) => n + 1);
  }, []);

  return <SessionContext value={{ state, api, signIn, refreshStage, signOut, deleteAccount, retry }}>{children}</SessionContext>;
}
