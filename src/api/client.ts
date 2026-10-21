import type {
  Budget,
  ErrorBody,
  Expense,
  ExpensePage,
  ExpenseUpdate,
  FieldError,
  Home,
  Me,
  MonthStats,
  NewExpense,
  PetType,
  Provider,
  TokenResponse,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: FieldError[] = [],
  ) {
    super(`API error ${status} ${code}`);
    this.name = 'ApiError';
  }

  fieldMessage(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

// The server did not answer in time. A write may still have been applied on the server.
export class RequestTimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'RequestTimeoutError';
  }
}

export const REQUEST_TIMEOUT_MS = 10_000;

export type TokenStore = {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clear(): Promise<void>;
};

type ApiClientOptions = {
  baseUrl: string;
  tokenStore: TokenStore;
  onSessionExpired: () => void;
};

const EXPENSE_PAGE_SIZE = 20;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

// A response whose JSON body (if any) was already read within the request time limit.
type Reply = { ok: boolean; status: number; body: unknown };

function toApiError(res: Reply): ApiError {
  const body = (res.body ?? {}) as Partial<ErrorBody>;
  return new ApiError(res.status, body.code ?? 'UNKNOWN', body.fields ?? []);
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ baseUrl, tokenStore, onSessionExpired }: ApiClientOptions) {
  // The access token lives only in memory; the refresh token is persisted by tokenStore.
  let accessToken: string | null = null;
  let refreshing: Promise<boolean> | null = null;
  // Bumped when the session is ended locally; a refresh that started earlier must not save tokens.
  let generation = 0;

  async function send(method: Method, path: string, body?: unknown, auth = true): Promise<Reply> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    // The limit covers the whole exchange, body included. A body read may ignore the abort
    // signal, so race it against the timer too.
    const controller = new AbortController();
    const timedOut = new Promise<never>((_, reject) => {
      controller.signal.addEventListener('abort', () => reject(new RequestTimeoutError()));
    });
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await Promise.race([
        fetch(`${baseUrl}${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        }),
        timedOut,
      ]);
      // A success body must parse (a 200 HTML page is a failure); 204 and error bodies may be empty or non-JSON.
      const reading: Promise<unknown> =
        res.status === 204 ? Promise.resolve(undefined) : res.ok ? res.json() : res.json().catch(() => undefined);
      const parsed = await Promise.race([reading, timedOut]);
      return { ok: res.ok, status: res.status, body: parsed };
    } catch (e) {
      if (controller.signal.aborted) throw new RequestTimeoutError();
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  // `startedAt` is set by refresh: if the session ended while the refresh was in flight, drop the tokens.
  async function saveTokens(res: Reply, startedAt?: number) {
    const tokens = res.body as TokenResponse;
    if (startedAt !== undefined && startedAt !== generation) return false;
    accessToken = tokens.accessToken;
    await tokenStore.setRefreshToken(tokens.refreshToken);
    return true;
  }

  async function expire() {
    accessToken = null;
    await tokenStore.clear();
    onSessionExpired();
  }

  // A refresh token works only once, so concurrent callers share one in-flight refresh.
  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const startedAt = generation;
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) return false;
        const res = await send('POST', '/auth/refresh', { refreshToken }, false);
        if (startedAt !== generation) return false;
        if (res.status === 401) {
          await expire();
          return false;
        }
        if (!res.ok) throw toApiError(res);
        return await saveTokens(res, startedAt);
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let res = await send(method, path, body);
    if (res.status === 401) {
      if (!(await refresh())) throw new ApiError(401, 'UNAUTHORIZED');
      res = await send(method, path, body);
    }
    if (!res.ok) throw toApiError(res);
    if (res.status === 204) return undefined as T;
    return res.body as T;
  }

  return {
    async login(provider: Provider, credential: string) {
      const res = await send('POST', `/auth/login/${provider}`, { credential }, false);
      if (!res.ok) throw toApiError(res);
      await saveTokens(res);
    },
    restoreSession: refresh,
    // Never fails: whatever the server or the token store says, the local session ends.
    async logout() {
      try {
        // Let an in-flight refresh finish first so the server logout uses the latest token.
        await refreshing?.catch(() => undefined);
        generation += 1;
        const refreshToken = await tokenStore.getRefreshToken();
        if (refreshToken) await send('POST', '/auth/logout', { refreshToken }, false);
      } catch {
        // The refresh token may already be invalid or the server unreachable.
      }
      generation += 1;
      accessToken = null;
      try {
        await tokenStore.clear();
      } catch {
        // Nothing more can be done; the in-memory session is already gone.
      }
    },
    async deleteMe() {
      await request<void>('DELETE', '/users/me');
      // The account is gone on the server: end the local session even if the clear fails.
      generation += 1;
      accessToken = null;
      try {
        await tokenStore.clear();
      } catch {
        // Nothing more can be done locally.
      }
    },
    getMe: () => request<Me>('GET', '/users/me'),
    putPet: (petType: PetType) => request<Me>('PUT', '/users/me/pet', { petType }),
    getBudget: (month: string) => request<Budget>('GET', `/months/${month}/budget`),
    putBudget: (month: string, amount: number) =>
      request<Budget>('PUT', `/months/${month}/budget`, { amount }),
    getHome: () => request<Home>('GET', '/home'),
    createExpense: (body: NewExpense) => request<Expense>('POST', '/expenses', body),
    getExpense: (id: number) => request<Expense>('GET', `/expenses/${id}`),
    updateExpense: (id: number, body: ExpenseUpdate) =>
      request<Expense>('PATCH', `/expenses/${id}`, body),
    deleteExpense: (id: number) => request<void>('DELETE', `/expenses/${id}`),
    getMonthStats: (month: string) => request<MonthStats>('GET', `/months/${month}/stats`),
    // The cursor is opaque: pass it back exactly as received.
    getMonthExpenses: (month: string, cursor?: string) =>
      request<ExpensePage>(
        'GET',
        `/months/${month}/expenses?limit=${EXPENSE_PAGE_SIZE}` +
          (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''),
      ),
  };
}
