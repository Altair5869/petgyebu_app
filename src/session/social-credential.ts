import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';

import type { Provider } from '@/api/types';
import { devLoginId, googleIosClientId, googleWebClientId, kakaoNativeAppKey } from '@/config';

export class SocialLoginCancelledError extends Error {
  constructor() {
    super('social login was cancelled');
    this.name = 'SocialLoginCancelledError';
  }
}

export class SocialLoginUnavailableError extends Error {
  constructor(provider: Provider) {
    super(`${provider} login is not configured`);
    this.name = 'SocialLoginUnavailableError';
  }
}

// The Kakao iOS module rejects every failure with code "RNKakaoLogins"; a user cancel is only
// visible as the "ClientFailed(Cancelled)" prefix of the message (RNKakaoLogins.swift `describe`).
function isKakaoCancel(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('ClientFailed(Cancelled)');
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

async function googleCredential(): Promise<string> {
  if (!googleIosClientId || !googleWebClientId) throw new SocialLoginUnavailableError('google');
  GoogleSignin.configure({ iosClientId: googleIosClientId, webClientId: googleWebClientId });
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
