import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { REQUEST_TIMEOUT_MS, type TokenStore } from '@/api/client';
import { SessionProvider, useSession } from '@/session/session-provider';

jest.mock('expo-secure-store', () => ({}));
jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
}));
jest.mock('@/config', () => ({
  devLoginId: 'test-user',
  kakaoNativeAppKey: null,
  googleIosClientId: null,
  googleWebClientId: null,
}));

type Handler = (url: string) => Response | Promise<Response>;

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

let handler: Handler;
let bodies: Record<string, string | undefined>;
beforeEach(() => {
  bodies = {};
  globalThis.fetch = jest.fn((url: string, init?: RequestInit) => {
    bodies[url] = init?.body as string | undefined;
    return Promise.resolve(handler(url));
  }) as unknown as typeof fetch;
});

function storeWith(token: string | null) {
  return {
    getRefreshToken: jest.fn(async () => token),
    setRefreshToken: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } satisfies TokenStore;
}

function Probe() {
  const { state, signIn, refreshStage, retry } = useSession();
  return (
    <>
      <Text>{state.status === 'signedIn' ? `signedIn:${state.stage}` : state.status}</Text>
      <Pressable onPress={retry}>
        <Text>retry</Text>
      </Pressable>
      <Pressable onPress={() => signIn('kakao')}>
        <Text>signIn</Text>
      </Pressable>
      <Pressable onPress={() => refreshStage()}>
        <Text>refresh</Text>
      </Pressable>
    </>
  );
}

async function renderSession(store: TokenStore) {
  await render(
    <SessionProvider baseUrl="http://api.test/api/v1" tokenStore={store}>
      <Probe />
    </SessionProvider>,
  );
}

const TOKENS = { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 };

test('is signed out without a stored refresh token', async () => {
  handler = () => {
    throw new Error('should not call the server');
  };
  await renderSession(storeWith(null));

  await screen.findByText('signedOut');
});

test('goes to the pet stage without asking for the budget', async () => {
  const urls: string[] = [];
  handler = (url) => {
    urls.push(url);
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: null });
  };
  await renderSession(storeWith('r0'));

  await screen.findByText('signedIn:pet');
  expect(urls.some((u) => u.includes('/budget'))).toBe(false);
});

test('goes to the budget stage when the current month has no budget', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    if (url.endsWith('/users/me')) return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: 'CAT' });
    return jsonResponse(200, { month: '2026-10', amount: null });
  };
  await renderSession(storeWith('r0'));

  await screen.findByText('signedIn:budget');
});

test('signs out and clears the token when the refresh token is rejected', async () => {
  handler = () => jsonResponse(401, { code: 'UNAUTHORIZED' });
  const store = storeWith('r0');
  await renderSession(store);

  await screen.findByText('signedOut');
  expect(store.clear).toHaveBeenCalled();
});

test('shows an error and keeps the token when the server is unreachable', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    throw new TypeError('Network request failed');
  };
  const store = storeWith('r0');
  await renderSession(store);

  await screen.findByText('error');
  expect(store.clear).not.toHaveBeenCalled();
});

test('a session restore that times out shows the retry screen and keeps the token', async () => {
  jest.useFakeTimers();
  try {
    globalThis.fetch = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    ) as unknown as typeof fetch;
    const store = storeWith('r0');
    await renderSession(store);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    });
    await screen.findByText('error');
    expect(store.clear).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('retry reboots the session after a network failure', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    throw new TypeError('Network request failed');
  };
  await renderSession(storeWith('r0'));
  await screen.findByText('error');

  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: null });
  };
  await fireEvent.press(screen.getByText('retry'));

  await screen.findByText('signedIn:pet');
});

test('signIn logs in with the dev credential and resolves the stage', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/login/kakao')) return jsonResponse(200, TOKENS);
    return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: null });
  };
  await renderSession(storeWith(null));
  await screen.findByText('signedOut');

  await fireEvent.press(screen.getByText('signIn'));

  await screen.findByText('signedIn:pet');
  const body = bodies['http://api.test/api/v1/auth/login/kakao'];
  expect(JSON.parse(body as string).credential).toBe('ok:test-user');
});

test('refreshStage re-resolves the stage from the server', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: null });
  };
  await renderSession(storeWith('r0'));
  await screen.findByText('signedIn:pet');

  handler = (url) => {
    if (url.endsWith('/users/me')) return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: 'CAT' });
    return jsonResponse(200, { month: '2026-10', amount: 300000 });
  };
  await fireEvent.press(screen.getByText('refresh'));

  await screen.findByText('signedIn:ready');
});
