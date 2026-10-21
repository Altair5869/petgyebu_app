import { ApiError, RequestTimeoutError } from '@/api/client';
import { SocialLoginUnavailableError } from '@/session/social-login-errors';

export const CONNECTION_ERROR = '서버에 연결할 수 없어요. 다시 시도해 주세요.';
const LOGIN_UNAVAILABLE = '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.';
export const SAVE_UNCONFIRMED = '저장됐는지 확인하지 못했어요. 다시 저장해도 한 번만 기록돼요.';
export const UPDATE_UNCONFIRMED = '수정됐는지 확인하지 못했어요. 월별 통계에서 확인해 주세요.';
export const DELETE_UNCONFIRMED = '삭제됐는지 확인하지 못했어요. 월별 통계에서 확인해 주세요.';

// Writes pass their own timeout copy: the server may have applied the change before we gave up.
export function errorMessage(error: unknown, timeoutMessage: string = CONNECTION_ERROR): string {
  if (error instanceof RequestTimeoutError) return timeoutMessage;
  if (error instanceof SocialLoginUnavailableError) return LOGIN_UNAVAILABLE;
  if (error instanceof ApiError) {
    if (error.code === 'IDEMPOTENCY_KEY_REUSED') return '이미 저장된 기록과 내용이 달라요. 월별 통계에서 확인해 주세요.';
    if (error.code === 'SOCIAL_LOGIN_FAILED') return '로그인에 실패했어요. 다시 시도해 주세요.';
    if (error.code === 'SOCIAL_LOGIN_UNAVAILABLE') {
      return LOGIN_UNAVAILABLE;
    }
  }
  return CONNECTION_ERROR;
}
