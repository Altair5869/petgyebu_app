import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { TokenStore } from '@/api/client';
import { SessionProvider, useSession } from '@/session/session-provider';

jest.mock('expo-secure-store', () => ({}));

type Handler = (url: string) => Response | Promise<Response>;

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

let handler: Handler;
beforeEach(() => {
  globalThis.fetch = jest.fn((url: string) => Promise.resolve(handler(url))) as unknown as typeof fetch;
});

function storeWith(token: string | null) {
  return {
    getRefreshToken: jest.fn(async () => token),
    setRefreshToken: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } satisfies TokenStore;
}

function Probe() {
  const { state } = useSession();
  return <Text>{state.status === 'signedIn' ? `signedIn:${state.stage}` : state.status}</Text>;
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
