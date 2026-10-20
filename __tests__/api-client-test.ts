import { ApiError, createApiClient, REQUEST_TIMEOUT_MS, RequestTimeoutError, type TokenStore } from '@/api/client';

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

test('creates an expense with the given body', async () => {
  const body = { amount: 12000, expenseDate: '2026-10-17', category: 'OTHER', memo: null } as const;
  handler = (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      return jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 });
    }
    expect(url).toBe(`${BASE}/expenses`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
    return jsonResponse(201, { id: 42, ...body });
  };
  const { api } = setup('r0');
  await api.restoreSession();

  await expect(api.createExpense(body)).resolves.toEqual({ id: 42, ...body });
});

test('requests a month page with limit 20 and an encoded cursor', async () => {
  const urls: string[] = [];
  handler = (url) => {
    urls.push(url);
    return jsonResponse(200, { items: [], nextCursor: null });
  };
  const { api } = setup();

  await api.getMonthExpenses('2026-10');
  await api.getMonthExpenses('2026-10', 'a+b/c=');

  expect(urls).toEqual([
    `${BASE}/months/2026-10/expenses?limit=20`,
    `${BASE}/months/2026-10/expenses?limit=20&cursor=a%2Bb%2Fc%3D`,
  ]);
});

const REFRESH_OK = { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 };

test('gets a single expense', async () => {
  const expense = { id: 42, amount: 5000 };
  handler = (url, init) => {
    expect(url).toBe(`${BASE}/expenses/42`);
    expect(init.method).toBe('GET');
    return jsonResponse(200, expense);
  };
  const { api } = setup();

  await expect(api.getExpense(42)).resolves.toEqual(expense);
});

test('patches an expense with exactly the given fields', async () => {
  handler = (url, init) => {
    expect(url).toBe(`${BASE}/expenses/42`);
    expect(init.method).toBe('PATCH');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"amount":7000,"memo":null}');
    return jsonResponse(200, { id: 42, amount: 7000, memo: null });
  };
  const { api } = setup();

  await expect(api.updateExpense(42, { amount: 7000, memo: null })).resolves.toEqual({
    id: 42,
    amount: 7000,
    memo: null,
  });
});

test('deletes an expense and resolves on an empty 204', async () => {
  handler = (url, init) => {
    expect(url).toBe(`${BASE}/expenses/42`);
    expect(init.method).toBe('DELETE');
    return new Response(null, { status: 204 });
  };
  const { api } = setup();

  await expect(api.deleteExpense(42)).resolves.toBeUndefined();
});

test('refreshes and retries an update that got 401', async () => {
  let patches = 0;
  handler = (url, init) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, REFRESH_OK);
    patches += 1;
    if (patches === 1) return jsonResponse(401, { code: 'UNAUTHORIZED' });
    expect(bearer(init)).toBe('Bearer a1');
    return jsonResponse(200, { id: 42, amount: 7000 });
  };
  const { api } = setup('r0');

  await expect(api.updateExpense(42, { amount: 7000 })).resolves.toEqual({ id: 42, amount: 7000 });
  expect(patches).toBe(2);
});

test('surfaces EXPENSE_NOT_FOUND when deleting a missing expense', async () => {
  handler = () => jsonResponse(404, { code: 'EXPENSE_NOT_FOUND' });
  const { api } = setup();

  await expect(api.deleteExpense(42)).rejects.toMatchObject({
    status: 404,
    code: 'EXPENSE_NOT_FOUND',
  });
  await expect(api.deleteExpense(42)).rejects.toBeInstanceOf(ApiError);
});

test('gets monthly stats from the stats endpoint with the Bearer token', async () => {
  const stats = {
    month: '2026-09',
    budgetAmount: null,
    spentAmount: 26000,
    expenseCount: 2,
    usagePercent: null,
    budgetBalanceAmount: null,
    categories: [{ category: 'FOOD', spentAmount: 26000, expenseCount: 2, sharePercent: 100 }],
  };
  handler = (url, init) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, REFRESH_OK);
    expect(url).toBe(`${BASE}/months/2026-09/stats`);
    expect(init.method).toBe('GET');
    expect(bearer(init)).toBe('Bearer a1');
    return jsonResponse(200, stats);
  };
  const { api } = setup('r0');
  await api.restoreSession();

  await expect(api.getMonthStats('2026-09')).resolves.toEqual(stats);
});

describe('request timeout', () => {
  // A server that accepts the connection but never answers; aborting rejects like real fetch.
  function hangingFetch(_url: string, init: RequestInit) {
    return new Promise<Response>((_, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockImplementation((url: string, init: RequestInit) => Promise.resolve(handler(url, init)));
  });

  test('gives up after 10 seconds with a RequestTimeoutError', async () => {
    fetchMock.mockImplementationOnce(hangingFetch);
    const { api } = setup();
    const result = api.getMe();
    const assertion = expect(result).rejects.toBeInstanceOf(RequestTimeoutError);

    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await assertion;
  });

  test('a response within the limit is returned and the timer is cleared', async () => {
    handler = () => jsonResponse(200, ME);
    const { api } = setup();

    await expect(api.getMe()).resolves.toEqual(ME);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('other network errors are passed through unchanged', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')));
    const { api } = setup();

    await expect(api.getMe()).rejects.toThrow(TypeError);
  });

  test('the retry after a token refresh gets its own 10 seconds', async () => {
    let calls = 0;
    fetchMock.mockImplementation((url: string) => {
      calls += 1;
      if (url.endsWith('/auth/refresh')) return Promise.resolve(jsonResponse(200, REFRESH_OK));
      if (calls === 1) return new Promise((resolve) => setTimeout(() => resolve(jsonResponse(401, { code: 'UNAUTHORIZED' })), 9000));
      return new Promise((resolve) => setTimeout(() => resolve(jsonResponse(200, ME)), 9000));
    });
    const { api } = setup('r0');
    const result = api.getMe();

    await jest.advanceTimersByTimeAsync(18000);
    await expect(result).resolves.toEqual(ME);
  });
});

describe('logout', () => {
  test('posts the refresh token without an Authorization header and clears the store', async () => {
    handler = () => jsonResponse(204);
    const { api, store, onSessionExpired } = setup('r1');

    await api.logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/logout`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'r1' });
    expect(bearer(init)).toBeUndefined();
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  test('clears the store and does not throw when the server answers 401', async () => {
    handler = () => jsonResponse(401, { code: 'UNAUTHORIZED' });
    const { api, store } = setup('r1');

    await expect(api.logout()).resolves.toBeUndefined();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  test('clears the store and does not throw on a network failure', async () => {
    handler = () => {
      throw new TypeError('Network request failed');
    };
    const { api, store } = setup('r1');

    await expect(api.logout()).resolves.toBeUndefined();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  test('skips the request when no refresh token is stored', async () => {
    const { api, store } = setup(null);

    await api.logout();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  test('drops the in-memory access token so later requests are unauthenticated', async () => {
    handler = (url) => {
      if (url.endsWith('/auth/login/kakao')) {
        return jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 });
      }
      return jsonResponse(204);
    };
    const { api } = setup();
    await api.login('kakao', 'ok:dev');

    await api.logout();
    fetchMock.mockClear();
    await api.getMe().catch(() => undefined);

    expect(bearer(fetchMock.mock.calls[0][1])).toBeUndefined();
  });

  test('gives up after the request timeout and still signs out locally', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      );
      const { api, store } = setup('r1');
      const done = api.logout();

      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      await expect(done).resolves.toBeUndefined();
      expect(store.clear).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
      fetchMock.mockImplementation((url: string, init: RequestInit) => Promise.resolve(handler(url, init)));
    }
  });
});

describe('deleteMe', () => {
  test('sends DELETE /users/me and clears the store on 204', async () => {
    handler = () => jsonResponse(204);
    const { api, store, onSessionExpired } = setup('r1');

    await expect(api.deleteMe()).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/users/me`);
    expect(init.method).toBe('DELETE');
    expect(store.clear).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  test('throws ApiError and keeps the token on a server error', async () => {
    handler = () => jsonResponse(500, { code: 'INTERNAL' });
    const { api, store } = setup('r1');

    await expect(api.deleteMe()).rejects.toMatchObject({ status: 500 });
    expect(store.clear).not.toHaveBeenCalled();
    expect(store.peek()).toBe('r1');
  });

  test('throws RequestTimeoutError and keeps the token on timeout', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementationOnce(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          }),
      );
      const { api, store } = setup('r1');
      const assertion = expect(api.deleteMe()).rejects.toBeInstanceOf(RequestTimeoutError);

      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      await assertion;
      expect(store.clear).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      fetchMock.mockImplementation((url: string, init: RequestInit) => Promise.resolve(handler(url, init)));
    }
  });
});
