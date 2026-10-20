import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  login as kakaoLogin,
  logout as kakaoLogout,
  unlink as kakaoUnlink,
} from '@react-native-seoul/kakao-login';

import {
  getSocialCredential,
  signOutSocial,
  unlinkSocial,
  SocialLoginCancelledError,
  SocialLoginUnavailableError,
} from '@/session/social-credential';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn(), logout: jest.fn(), unlink: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn(), signOut: jest.fn(), revokeAccess: jest.fn() },
}));
jest.mock('@/config', () => ({
  devLoginId: null,
  kakaoNativeAppKey: 'kakao-key',
  googleIosClientId: 'ios-client',
  googleWebClientId: 'web-client',
}));

const kakao = jest.mocked(kakaoLogin);
const googleSignIn = jest.mocked(GoogleSignin.signIn);

// Found in node_modules/@react-native-seoul/kakao-login/ios/RNKakaoLogins/RNKakaoLogins.swift:
// every iOS failure rejects with code "RNKakaoLogins"; a cancel is only visible in the message.
const kakaoCancel = Object.assign(new Error('ClientFailed(Cancelled): user cancelled'), {
  code: 'RNKakaoLogins',
});

beforeEach(() => jest.clearAllMocks());

test('uses the fake credential in development when a dev id is set', async () => {
  await expect(getSocialCredential('kakao', true, 'u1')).resolves.toBe('ok:u1');
  expect(kakao).not.toHaveBeenCalled();
  expect(googleSignIn).not.toHaveBeenCalled();
});

test.each([null, ''])('opens the real Kakao login in development with dev id %p', async (devId) => {
  kakao.mockResolvedValue({ accessToken: 'kakao-access' } as never);
  await expect(getSocialCredential('kakao', true, devId)).resolves.toBe('kakao-access');
});

test('opens the real Google login in a release build even when a dev id is set', async () => {
  googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id' } } as never);
  await expect(getSocialCredential('google', false, 'u1')).resolves.toBe('google-id');
  expect(GoogleSignin.configure).toHaveBeenCalledWith({
    iosClientId: 'ios-client',
    webClientId: 'web-client',
  });
});

test('maps a Kakao user cancel to SocialLoginCancelledError', async () => {
  kakao.mockRejectedValue(kakaoCancel);
  await expect(getSocialCredential('kakao', false, null)).rejects.toBeInstanceOf(SocialLoginCancelledError);
});

test('maps a Kakao consent-page cancel (AccessDenied) to SocialLoginCancelledError', async () => {
  const denied = Object.assign(new Error('AuthFailed(AccessDenied): user denied consent'), {
    code: 'RNKakaoLogins',
  });
  kakao.mockRejectedValue(denied);
  await expect(getSocialCredential('kakao', false, null)).rejects.toBeInstanceOf(SocialLoginCancelledError);
});

test('rethrows other Kakao errors unchanged', async () => {
  const other = Object.assign(new Error('ApiFailed(InvalidParameter): bad request'), {
    code: 'RNKakaoLogins',
  });
  kakao.mockRejectedValue(other);
  await expect(getSocialCredential('kakao', false, null)).rejects.toBe(other);
});

test('maps a Google cancel to SocialLoginCancelledError', async () => {
  googleSignIn.mockResolvedValue({ type: 'cancelled', data: null } as never);
  await expect(getSocialCredential('google', false, null)).rejects.toBeInstanceOf(SocialLoginCancelledError);
});

test('rejects a Google success without an idToken instead of sending an empty credential', async () => {
  googleSignIn.mockResolvedValue({ type: 'success', data: { idToken: null } } as never);
  await expect(getSocialCredential('google', false, null)).rejects.toBeInstanceOf(SocialLoginUnavailableError);
});

describe('without login keys', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/config', () => ({ devLoginId: null, kakaoNativeAppKey: null, googleIosClientId: null, googleWebClientId: null }));
  });
  afterEach(() => jest.dontMock('@/config'));

  test('Kakao is unavailable and never opens the SDK', async () => {
    const mod = require('@/session/social-credential') as typeof import('@/session/social-credential');
    const kakaoSdk = require('@react-native-seoul/kakao-login') as typeof import('@react-native-seoul/kakao-login');
    await expect(mod.getSocialCredential('kakao', false, null)).rejects.toBeInstanceOf(
      mod.SocialLoginUnavailableError,
    );
    expect(kakaoSdk.login).not.toHaveBeenCalled();
  });

  test('is unavailable and never opens Google', async () => {
    const mod = require('@/session/social-credential') as typeof import('@/session/social-credential');
    const google = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    await expect(mod.getSocialCredential('google', false, null)).rejects.toBeInstanceOf(
      mod.SocialLoginUnavailableError,
    );
    expect(google.GoogleSignin.signIn).not.toHaveBeenCalled();
  });
});

describe.each([
  ['signOutSocial', signOutSocial, kakaoLogout, GoogleSignin.signOut],
  ['unlinkSocial', unlinkSocial, kakaoUnlink, GoogleSignin.revokeAccess],
] as const)('%s', (_name, fn, kakaoSdk, googleSdk) => {
  test('calls only the Kakao SDK for kakao', async () => {
    await fn('kakao', false, null);
    expect(kakaoSdk).toHaveBeenCalledTimes(1);
    expect(googleSdk).not.toHaveBeenCalled();
  });

  test('calls only the Google SDK for google', async () => {
    await fn('google', false, null);
    expect(googleSdk).toHaveBeenCalledTimes(1);
    expect(kakaoSdk).not.toHaveBeenCalled();
  });

  test.each(['kakao', 'google'] as const)('resolves when the %s SDK rejects', async (provider) => {
    jest.mocked(kakaoSdk).mockRejectedValue(new Error('sdk failed'));
    jest.mocked(googleSdk).mockRejectedValue(new Error('sdk failed'));
    await expect(fn(provider, false, null)).resolves.toBeUndefined();
  });

  test.each(['kakao', 'google'] as const)('calls no SDK in fake-login mode for %s', async (provider) => {
    await fn(provider, true, 'u1');
    expect(kakaoSdk).not.toHaveBeenCalled();
    expect(googleSdk).not.toHaveBeenCalled();
  });
});
