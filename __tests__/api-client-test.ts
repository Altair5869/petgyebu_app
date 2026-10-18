import { ApiError, createApiClient, type TokenStore } from '@/api/client';

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function memoryStore(initial: string | null = null) {
  let token = initial;
  return {
    getRefreshToken: jest.fn(async () => token),
    setRefreshToken: jest.fn(async (next: string) => {
      token = next;
    }),
    clear: jest.fn(async () => {
      token = null;
    }),
    peek: () => token,
  } satisfies TokenStore & { peek: () => string | null };
}

const BASE = 'http://api.test/api/v1';
let handler: Handler;
const fetchMock = jest.fn((url: string, init: RequestInit) => Promise.resolve(handler(url, init)));

beforeEach(() => {
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

function bearer(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>).Authorization;
}

function setup(initialRefresh: string | null = null) {
  const store = memoryStore(initialRefresh);
  const onSessionExpired = jest.fn();
  const api = createApiClient({ baseUrl: BASE, tokenStore: store, onSessionExpired });
  return { api, store, onSessionExpired };
}

const ME = { id: 1, provider: 'KAKAO', petType: null };

test('sends the login access token as a Bearer header and stores the refresh token', async () => {
  handler = (url, init) => {
    if (url === `${BASE}/auth/login/kakao`) {
      expect(JSON.parse(init.body as string)).toEqual({ credential: 'ok:dev' });
      return jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 });
    }
    expect(bearer(init)).toBe('Bearer a1');
    return jsonResponse(200, ME);
  };
  const { api, store } = setup();

  await api.login('kakao', 'ok:dev');
  await expect(api.getMe()).resolves.toEqual(ME);
  expect(store.peek()).toBe('r1');
});

test('turns an error body into ApiError with code and field messages', async () => {
  handler = () =>
    jsonResponse(400, {
      code: 'INVALID_REQUEST',
      message: '입력 오류',
      fields: [{ field: 'amount', message: '금액을 확인해 주세요' }],
    });
  const { api } = setup();

  const error = await api.putBudget('2026-10', 0).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  expect((error as ApiError).fieldMessage('amount')).toBe('금액을 확인해 주세요');
});

test('falls back to UNKNOWN when the error body has no code', async () => {
  handler = () => jsonResponse(502, {});
  const { api } = setup();

  const error = await api.getMe().catch((e: unknown) => e);
  expect(error).toMatchObject({ status: 502, code: 'UNKNOWN' });
});

test('refreshes after a 401 and retries the request once', async () => {
  handler = (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'r0' });
      return jsonResponse(200, { accessToken: 'a2', refreshToken: 'r2', accessExpiresInSeconds: 900 });
    }
    return bearer(init) === 'Bearer a2' ? jsonResponse(200, ME) : jsonResponse(401, { code: 'UNAUTHORIZED' });
  };
  const { api, store } = setup('r0');

  await expect(api.getMe()).resolves.toEqual(ME);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(store.peek()).toBe('r2');
});

test('shares one refresh across concurrent 401 responses', async () => {
  let refreshCalls = 0;
  handler = async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse(200, { accessToken: 'a2', refreshToken: 'r2', accessExpiresInSeconds: 900 });
    }
    return bearer(init) === 'Bearer a2' ? jsonResponse(200, ME) : jsonResponse(401, { code: 'UNAUTHORIZED' });
  };
  const { api } = setup('r0');

  await expect(Promise.all([api.getMe(), api.getMe(), api.getMe()])).resolves.toHaveLength(3);
  expect(refreshCalls).toBe(1);
});

test('expires the session when the refresh token is rejected', async () => {
  handler = () => jsonResponse(401, { code: 'UNAUTHORIZED' });
  const { api, store, onSessionExpired } = setup('r0');

  const error = await api.getMe().catch((e: unknown) => e);
  expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  expect(store.clear).toHaveBeenCalled();
  expect(onSessionExpired).toHaveBeenCalledTimes(1);
});

test('restoreSession reports false without a stored refresh token', async () => {
  handler = () => {
    throw new Error('should not call the server');
  };
  const { api } = setup(null);

  await expect(api.restoreSession()).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('keeps the session when refresh fails with a network error', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
    return jsonResponse(401, { code: 'UNAUTHORIZED' });
  };
  const { api, store, onSessionExpired } = setup('r0');

  await expect(api.getMe()).rejects.toThrow('Network request failed');
  expect(store.clear).not.toHaveBeenCalled();
  expect(onSessionExpired).not.toHaveBeenCalled();
  expect(store.peek()).toBe('r0');
});

test('never puts tokens into error messages', async () => {
  handler = (url) =>
    url.endsWith('/auth/login/google')
      ? jsonResponse(200, { accessToken: 'secret-access', refreshToken: 'secret-refresh', accessExpiresInSeconds: 900 })
      : jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류' });
  const { api } = setup();

  await api.login('google', 'ok:dev');
  const error = (await api.getHome().catch((e: unknown) => e)) as Error;
  expect(String(error)).not.toMatch(/secret/);
  expect(error.message).not.toMatch(/secret/);
});
