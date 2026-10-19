import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';

import {
  getSocialCredential,
  SocialLoginCancelledError,
  SocialLoginUnavailableError,
} from '@/session/social-credential';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
}));
jest.mock('@/config', () => ({
  devLoginId: null,
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

test('rethrows other Kakao errors unchanged', async () => {
  const other = Object.assign(new Error('ClientFailed(MustInitAppKey): not initialized'), {
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

describe('without Google client ids', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/config', () => ({ devLoginId: null, googleIosClientId: null, googleWebClientId: null }));
  });
  afterEach(() => jest.dontMock('@/config'));

  test('is unavailable and never opens Google', async () => {
    const mod = require('@/session/social-credential') as typeof import('@/session/social-credential');
    const google = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    await expect(mod.getSocialCredential('google', false, null)).rejects.toBeInstanceOf(
      mod.SocialLoginUnavailableError,
    );
    expect(google.GoogleSignin.signIn).not.toHaveBeenCalled();
  });
});
