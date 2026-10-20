import type { Provider } from '@/api/types';

// Kept apart from social-credential.ts so screens and error copy can use these without loading
// the native login SDKs (which also keeps their tests free of SDK mocks).

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
