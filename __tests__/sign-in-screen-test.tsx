import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import SignInScreen from '@/app/sign-in';

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
  const button = screen.getByText('카카오로 시작하기');
  await fireEvent.press(button);
  await fireEvent.press(button);

  expect(mockSignIn).toHaveBeenCalledTimes(1);
});

test('shows the failure message when the social login is rejected', async () => {
  mockSignIn.mockRejectedValue(new ApiError(401, 'SOCIAL_LOGIN_FAILED'));
  await render(<SignInScreen />);

  await fireEvent.press(screen.getByText('카카오로 시작하기'));

  await screen.findByText('로그인에 실패했어요. 다시 시도해 주세요.');
});
