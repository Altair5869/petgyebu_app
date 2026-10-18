import type { Budget, ErrorBody, FieldError, Home, Me, PetType, Provider, TokenResponse } from './types';

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

type Method = 'GET' | 'POST' | 'PUT';

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ErrorBody;
    return new ApiError(res.status, body.code, body.fields ?? []);
  } catch {
    return new ApiError(res.status, 'UNKNOWN');
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ baseUrl, tokenStore, onSessionExpired }: ApiClientOptions) {
  // The access token lives only in memory; the refresh token is persisted by tokenStore.
  let accessToken: string | null = null;
  let refreshing: Promise<boolean> | null = null;

  function send(method: Method, path: string, body?: unknown, auth = true) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function saveTokens(res: Response) {
    const tokens = (await res.json()) as TokenResponse;
    accessToken = tokens.accessToken;
    await tokenStore.setRefreshToken(tokens.refreshToken);
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
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) return false;
        const res = await send('POST', '/auth/refresh', { refreshToken }, false);
        if (res.status === 401) {
          await expire();
          return false;
        }
        if (!res.ok) throw await toApiError(res);
        await saveTokens(res);
        return true;
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
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as T;
  }

  return {
    async login(provider: Provider, credential: string) {
      const res = await send('POST', `/auth/login/${provider}`, { credential }, false);
      if (!res.ok) throw await toApiError(res);
      await saveTokens(res);
    },
    restoreSession: refresh,
    getMe: () => request<Me>('GET', '/users/me'),
    putPet: (petType: PetType) => request<Me>('PUT', '/users/me/pet', { petType }),
    getBudget: (month: string) => request<Budget>('GET', `/months/${month}/budget`),
    putBudget: (month: string, amount: number) =>
      request<Budget>('PUT', `/months/${month}/budget`, { amount }),
    getHome: () => request<Home>('GET', '/home'),
  };
}
