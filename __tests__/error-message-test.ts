import { ApiError, RequestTimeoutError } from '@/api/client';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { SocialLoginUnavailableError } from '@/session/social-login-errors';

test('maps social login errors to app copy', () => {
  expect(errorMessage(new ApiError(401, 'SOCIAL_LOGIN_FAILED'))).toBe('로그인에 실패했어요. 다시 시도해 주세요.');
  expect(errorMessage(new ApiError(503, 'SOCIAL_LOGIN_UNAVAILABLE'))).toBe(
    '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.',
  );
  expect(errorMessage(new SocialLoginUnavailableError('kakao'))).toBe('지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.');
});

test('falls back to the connection message for network and server errors', () => {
  expect(errorMessage(new TypeError('Network request failed'))).toBe(CONNECTION_ERROR);
  expect(errorMessage(new ApiError(500, 'INTERNAL_ERROR'))).toBe(CONNECTION_ERROR);
});

test('a timeout uses the caller-supplied message, or the connection message by default', () => {
  expect(errorMessage(new RequestTimeoutError())).toBe(CONNECTION_ERROR);
  expect(errorMessage(new RequestTimeoutError(), '저장됐는지 확인하지 못했어요. 월별 통계에서 확인해 주세요.')).toBe(
    '저장됐는지 확인하지 못했어요. 월별 통계에서 확인해 주세요.',
  );
  expect(errorMessage(new TypeError('Network request failed'), '다른 문구')).toBe(CONNECTION_ERROR);
});

test('maps a reused idempotency key to the conflict copy', () => {
  expect(errorMessage(new ApiError(409, 'IDEMPOTENCY_KEY_REUSED'))).toBe(
    '이미 저장된 기록과 내용이 달라요. 월별 통계에서 확인해 주세요.',
  );
});
