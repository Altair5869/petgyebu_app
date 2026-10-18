import { ApiError } from '@/api/client';
import { SocialLoginNotReadyError } from '@/session/social-credential';

export const CONNECTION_ERROR = '서버에 연결할 수 없어요. 다시 시도해 주세요.';

export function errorMessage(error: unknown): string {
  if (error instanceof SocialLoginNotReadyError) return '아직 준비 중인 로그인이에요.';
  if (error instanceof ApiError) {
    if (error.code === 'SOCIAL_LOGIN_FAILED') return '로그인에 실패했어요. 다시 시도해 주세요.';
    if (error.code === 'SOCIAL_LOGIN_UNAVAILABLE') {
      return '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.';
    }
  }
  return CONNECTION_ERROR;
}
