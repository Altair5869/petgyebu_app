import { ApiError } from '@/api/client';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { SocialLoginNotReadyError } from '@/session/social-credential';

test('maps social login errors to app copy', () => {
  expect(errorMessage(new ApiError(401, 'SOCIAL_LOGIN_FAILED'))).toBe('로그인에 실패했어요. 다시 시도해 주세요.');
  expect(errorMessage(new ApiError(503, 'SOCIAL_LOGIN_UNAVAILABLE'))).toBe(
    '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.',
  );
  expect(errorMessage(new SocialLoginNotReadyError('kakao'))).toBe('아직 준비 중인 로그인이에요.');
});

test('falls back to the connection message for network and server errors', () => {
  expect(errorMessage(new TypeError('Network request failed'))).toBe(CONNECTION_ERROR);
  expect(errorMessage(new ApiError(500, 'INTERNAL_ERROR'))).toBe(CONNECTION_ERROR);
});
