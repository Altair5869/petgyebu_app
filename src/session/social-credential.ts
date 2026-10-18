import type { Provider } from '@/api/types';
import { devLoginId } from '@/config';

export class SocialLoginNotReadyError extends Error {
  constructor(provider: Provider) {
    super(`${provider} login is not available yet`);
    this.name = 'SocialLoginNotReadyError';
  }
}

// Until the Kakao/Google SDKs are wired, development builds use the
// backend bootTestRun fake verifier, which accepts `ok:<id>`.
export async function getSocialCredential(provider: Provider, isDev: boolean = __DEV__): Promise<string> {
  if (!isDev) throw new SocialLoginNotReadyError(provider);
  return `ok:${devLoginId}`;
}
