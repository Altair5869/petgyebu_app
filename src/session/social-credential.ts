import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { login as kakaoLogin, logout as kakaoLogout, unlink as kakaoUnlink } from '@react-native-seoul/kakao-login';
import { Platform } from 'react-native';

import type { Provider } from '@/api/types';
import { devLoginId, googleIosClientId, googleWebClientId, kakaoNativeAppKey } from '@/config';

import { SocialLoginCancelledError, SocialLoginUnavailableError } from './social-login-errors';

// The Kakao module rejects every failure with code "RNKakaoLogins"; a user cancel is only visible in
// the message. iOS prefixes it (RNKakaoLogins.swift `describe`): "ClientFailed(Cancelled)" when the
// login window is closed, "AuthFailed(AccessDenied)" when 취소 is tapped on the web consent page.
const KAKAO_CANCEL_PREFIXES = ['ClientFailed(Cancelled)', 'AuthFailed(AccessDenied)'];
// Android passes the Kakao SDK message as-is: ClientError(Cancelled) when the login window is closed
// or KakaoTalk login is cancelled, and LoginBridgeActivity's message.
const KAKAO_ANDROID_CANCEL_MESSAGES = ['user cancelled.', 'Login canceled by user.'];

function isKakaoCancel(error: unknown): boolean {
  return (
    error instanceof Error &&
    (KAKAO_CANCEL_PREFIXES.some((prefix) => error.message.startsWith(prefix)) ||
      KAKAO_ANDROID_CANCEL_MESSAGES.includes(error.message))
  );
}

async function kakaoCredential(): Promise<string> {
  // Without the key the config plugin is skipped and the native module would reject with MustInitAppKey.
  if (!kakaoNativeAppKey) throw new SocialLoginUnavailableError('kakao');
  try {
    return (await kakaoLogin()).accessToken;
  } catch (error) {
    if (isKakaoCancel(error)) throw new SocialLoginCancelledError();
    throw error;
  }
}

// Every platform needs the web client id (the ID token's audience); only iOS also needs its own client id.
export function hasGoogleClientIds(os: string = Platform.OS): boolean {
  return Boolean(googleWebClientId) && (os !== 'ios' || Boolean(googleIosClientId));
}

function configureGoogle(): void {
  GoogleSignin.configure({ iosClientId: googleIosClientId ?? undefined, webClientId: googleWebClientId ?? undefined });
}

async function googleCredential(): Promise<string> {
  if (!hasGoogleClientIds()) throw new SocialLoginUnavailableError('google');
  configureGoogle();
  const response = await GoogleSignin.signIn();
  if (response.type === 'cancelled') throw new SocialLoginCancelledError();
  if (!response.data.idToken) throw new SocialLoginUnavailableError('google');
  return response.data.idToken;
}

// Development builds with EXPO_PUBLIC_DEV_LOGIN_ID use the backend bootTestRun fake verifier
// (`ok:<id>`); everything else opens the real Kakao/Google SDK.
export async function getSocialCredential(
  provider: Provider,
  isDev: boolean = __DEV__,
  devId: string | null = devLoginId,
): Promise<string> {
  if (isDev && devId) return `ok:${devId}`;
  return provider === 'kakao' ? kakaoCredential() : googleCredential();
}

// After a cold start the SDK is neither configured nor signed in, so signOut/revokeAccess would do
// nothing. Configure it and restore the previous sign-in first.
async function restoreGoogleSession(): Promise<void> {
  if (!hasGoogleClientIds()) return;
  configureGoogle();
  if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signInSilently();
}

// The server session is already settled when these run, so SDK failures are swallowed.
async function runSdk(
  provider: Provider,
  isDev: boolean,
  devId: string | null,
  kakao: () => Promise<unknown>,
  google: () => Promise<unknown>,
): Promise<void> {
  if (isDev && devId) return;
  try {
    await (provider === 'kakao' ? kakao() : google());
  } catch {
    // Nothing to recover: the user is signed out of this app either way.
  }
}

export function signOutSocial(
  provider: Provider,
  isDev: boolean = __DEV__,
  devId: string | null = devLoginId,
): Promise<void> {
  return runSdk(provider, isDev, devId, kakaoLogout, async () => {
    await restoreGoogleSession().catch(() => undefined);
    await GoogleSignin.signOut();
  });
}

export function unlinkSocial(
  provider: Provider,
  isDev: boolean = __DEV__,
  devId: string | null = devLoginId,
): Promise<void> {
  return runSdk(provider, isDev, devId, kakaoUnlink, async () => {
    await restoreGoogleSession().catch(() => undefined);
    await GoogleSignin.revokeAccess();
  });
}
