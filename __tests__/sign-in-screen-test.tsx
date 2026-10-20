import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import SignInScreen from '@/app/sign-in';
import { SocialLoginCancelledError } from '@/session/social-credential';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
}));

const mockSignIn = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ signIn: mockSignIn }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('ignores a second press while sign-in is pending', async () => {
  mockSignIn.mockReturnValue(new Promise(() => {}));
  await render(<SignInScreen />);

  // The label is replaced by a spinner while pending, so keep the element from before the first press.
  const button = screen.getByRole('button', { name: '카카오 로그인' });
  await fireEvent.press(button);
  await fireEvent.press(button);

  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

test('shows the failure message when the social login is rejected', async () => {
  mockSignIn.mockRejectedValue(new ApiError(401, 'SOCIAL_LOGIN_FAILED'));
  await render(<SignInScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));

  await screen.findByText('로그인에 실패했어요. 다시 시도해 주세요.');
});

test('shows the unavailable message when the server has no login configured', async () => {
  mockSignIn.mockRejectedValue(new ApiError(503, 'SOCIAL_LOGIN_UNAVAILABLE'));
  await render(<SignInScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));

  await screen.findByText('지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.');
});

test('starts Google sign-in from the Google button', async () => {
  mockSignIn.mockReturnValue(new Promise(() => {}));
  await render(<SignInScreen />);

  await fireEvent.press(screen.getByRole('button', { name: 'Google로 로그인' }));

  expect(mockSignIn).toHaveBeenCalledWith('google');
});

test('stays quiet and lets the user retry after cancelling the login window', async () => {
  mockSignIn.mockRejectedValueOnce(new SocialLoginCancelledError());
  mockSignIn.mockReturnValue(new Promise(() => {}));
  await render(<SignInScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));

  await waitFor(() => expect(screen.getByRole('button', { name: '카카오 로그인' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeEnabled();
  expect(screen.queryByText('로그인에 실패했어요. 다시 시도해 주세요.')).toBeNull();
  expect(screen.queryByText('지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.')).toBeNull();
  expect(screen.queryByText('서버에 연결할 수 없어요. 다시 시도해 주세요.')).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: '카카오 로그인' }));
  expect(mockSignIn).toHaveBeenCalledTimes(2);
});
