import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { RequestTimeoutError } from '@/api/client';
import SettingsScreen from '@/app/settings/index';
import { CONNECTION_ERROR } from '@/lib/error-message';

const mockApi = { getMe: jest.fn(), putPet: jest.fn(), getBudget: jest.fn() };
const mockSignOut = jest.fn();
const mockDeleteAccount = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, signOut: mockSignOut, deleteAccount: mockDeleteAccount }),
}));

let mockStackOptions: { gestureEnabled?: boolean; headerBackVisible?: boolean } | undefined;
let mockFocusEffect: (() => void) | undefined;

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    Stack: { Screen: (props: { options: typeof mockStackOptions }) => { mockStackOptions = props.options; return null; } },
    useFocusEffect: (effect: () => void) => {
      mockFocusEffect = effect;
      useEffect(() => effect(), [effect]);
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00+09:00'), doNotFake: ['setTimeout', 'clearTimeout', 'setImmediate', 'queueMicrotask', 'nextTick'] });
  mockApi.getMe.mockResolvedValue({ id: 1, provider: 'KAKAO', petType: 'CAT' });
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
});

afterEach(() => {
  jest.useRealTimers();
});

test('shows the provider, selected pet and current month budget', async () => {
  await render(<SettingsScreen />);

  await screen.findByText('카카오로 로그인됨');
  expect(screen.getByRole('radio', { name: '고양이' })).toBeSelected();
  expect(screen.getByRole('radio', { name: '강아지' })).not.toBeSelected();
  screen.getByText('2026년 10월 예산');
  screen.getByText('300,000원');
  expect(mockApi.getBudget).toHaveBeenCalledWith('2026-10');
});

test('shows the Google provider', async () => {
  mockApi.getMe.mockResolvedValue({ id: 1, provider: 'GOOGLE', petType: 'CAT' });
  await render(<SettingsScreen />);

  await screen.findByText('Google로 로그인됨');
});

test('changes the pet optimistically and locks both choices while saving', async () => {
  let resolve: (value: unknown) => void = () => {};
  mockApi.putPet.mockReturnValue(new Promise((r) => (resolve = r)));
  await render(<SettingsScreen />);
  await screen.findByText('카카오로 로그인됨');

  await fireEvent.press(screen.getByRole('radio', { name: '강아지' }));

  expect(mockApi.putPet).toHaveBeenCalledWith('DOG');
  expect(screen.getByRole('radio', { name: '강아지' })).toBeSelected();
  expect(screen.getByRole('radio', { name: '고양이' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: '강아지' })).toBeDisabled();

  await act(async () => resolve({ id: 1, provider: 'KAKAO', petType: 'DOG' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: '고양이' })).toBeEnabled());
  expect(screen.getByRole('radio', { name: '강아지' })).toBeSelected();
});

test('reverts the pet and shows the error when saving fails', async () => {
  mockApi.putPet.mockRejectedValue(new TypeError('Network request failed'));
  await render(<SettingsScreen />);
  await screen.findByText('카카오로 로그인됨');

  await fireEvent.press(screen.getByRole('radio', { name: '강아지' }));

  await screen.findByText(CONNECTION_ERROR);
  expect(screen.getByRole('radio', { name: '고양이' })).toBeSelected();
  expect(screen.getByRole('radio', { name: '고양이' })).toBeEnabled();
});

test('clears an earlier error when the screen reloads on focus', async () => {
  mockApi.putPet.mockRejectedValue(new TypeError('Network request failed'));
  await render(<SettingsScreen />);
  await screen.findByText('카카오로 로그인됨');
  await fireEvent.press(screen.getByRole('radio', { name: '강아지' }));
  await screen.findByText(CONNECTION_ERROR);

  await act(async () => mockFocusEffect?.());

  await waitFor(() => expect(screen.queryByText(CONNECTION_ERROR)).toBeNull());
});

test('opens the budget edit screen', async () => {
  await render(<SettingsScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '변경' }));

  expect(router.push).toHaveBeenCalledWith('/settings/budget');
});

test('signs out with the signed-in provider', async () => {
  mockSignOut.mockReturnValue(new Promise(() => {}));
  await render(<SettingsScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '로그아웃' }));

  expect(mockSignOut).toHaveBeenCalledWith('KAKAO');
  expect(screen.getByRole('button', { name: '변경' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: '강아지' })).toBeDisabled();
});

describe('account deletion', () => {
  function pressedAlertButtons() {
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    return spy;
  }

  afterEach(() => jest.restoreAllMocks());

  test('asks first and does nothing on cancel', async () => {
    const alert = pressedAlertButtons();
    await render(<SettingsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: '회원 탈퇴' }));

    expect(alert).toHaveBeenCalledWith(
      '회원 탈퇴할까요?',
      '지출과 예산 기록이 모두 삭제되고 되돌릴 수 없어요.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0][2]!;
    const cancel = buttons.find((b) => b.text === '취소');
    cancel?.onPress?.();
    expect(mockDeleteAccount).not.toHaveBeenCalled();
  });

  test('deletes with the provider after confirming', async () => {
    const alert = pressedAlertButtons();
    mockDeleteAccount.mockResolvedValue(undefined);
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: '회원 탈퇴' }));

    await act(async () => alert.mock.calls[0][2]!.find((b) => b.text === '탈퇴')!.onPress!());

    expect(mockDeleteAccount).toHaveBeenCalledWith('KAKAO');
  });

  test('disables the back button and swipe while deleting and restores them afterwards', async () => {
    const alert = pressedAlertButtons();
    let finish!: () => void;
    mockDeleteAccount.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: '회원 탈퇴' }));
    expect(mockStackOptions).toMatchObject({ gestureEnabled: true, headerBackVisible: true });

    await act(async () => alert.mock.calls[0][2]!.find((b) => b.text === '탈퇴')!.onPress!());
    expect(mockStackOptions).toMatchObject({ gestureEnabled: false, headerBackVisible: false });

    await act(async () => finish());
    expect(mockStackOptions).toMatchObject({ gestureEnabled: true, headerBackVisible: true });
  });

  test('explains a timed-out deletion and re-enables the buttons', async () => {
    const alert = pressedAlertButtons();
    mockDeleteAccount.mockRejectedValue(new RequestTimeoutError());
    await render(<SettingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: '회원 탈퇴' }));

    await act(async () => alert.mock.calls[0][2]!.find((b) => b.text === '탈퇴')!.onPress!());

    await screen.findByText('탈퇴됐는지 확인하지 못했어요. 다시 시도해 주세요.');
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeEnabled();
  });

  test('keeps a deletion error when a slower focus reload lands afterwards', async () => {
    const alert = pressedAlertButtons();
    mockDeleteAccount.mockRejectedValue(new RequestTimeoutError());
    await render(<SettingsScreen />);
    await screen.findByRole('button', { name: '회원 탈퇴' });

    let resolveMe: (value: unknown) => void = () => {};
    mockApi.getMe.mockReturnValueOnce(new Promise((r) => (resolveMe = r)));
    await act(async () => mockFocusEffect?.());
    await fireEvent.press(screen.getByRole('button', { name: '회원 탈퇴' }));
    await act(async () => alert.mock.calls[0][2]!.find((b) => b.text === '탈퇴')!.onPress!());
    await screen.findByText('탈퇴됐는지 확인하지 못했어요. 다시 시도해 주세요.');

    await act(async () => resolveMe({ id: 1, provider: 'KAKAO', petType: 'CAT' }));
    expect(screen.getByText('탈퇴됐는지 확인하지 못했어요. 다시 시도해 주세요.')).toBeOnTheScreen();
  });
});

describe('pet save racing a focus refetch', () => {
  test('keeps the optimistic pet when a refetch started before the save resolves with the old one', async () => {
    let resolvePut: (value: unknown) => void = () => {};
    mockApi.putPet.mockReturnValue(new Promise((r) => (resolvePut = r)));
    await render(<SettingsScreen />);
    await screen.findByText('카카오로 로그인됨');
    await fireEvent.press(screen.getByRole('radio', { name: '강아지' }));

    await act(async () => mockFocusEffect?.()); // getMe still answers CAT
    await act(async () => resolvePut({ id: 1, provider: 'KAKAO', petType: 'DOG' }));

    await waitFor(() => expect(screen.getByRole('radio', { name: '강아지' })).toBeEnabled());
    expect(screen.getByRole('radio', { name: '강아지' })).toBeSelected();
  });

  test('reverts only the pet when the save fails after a refetch changed the budget', async () => {
    let rejectPut: (e: unknown) => void = () => {};
    mockApi.putPet.mockReturnValue(new Promise((_, r) => (rejectPut = r)));
    await render(<SettingsScreen />);
    await screen.findByText('300,000원');
    await fireEvent.press(screen.getByRole('radio', { name: '강아지' }));

    mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 450000 });
    await act(async () => mockFocusEffect?.());
    await screen.findByText('450,000원');
    await act(async () => rejectPut(new TypeError('Network request failed')));

    await screen.findByText(CONNECTION_ERROR);
    expect(screen.getByRole('radio', { name: '고양이' })).toBeSelected();
    screen.getByText('450,000원');
  });
});

test('offers a retry when loading fails', async () => {
  mockApi.getMe.mockRejectedValueOnce(new TypeError('Network request failed'));
  await render(<SettingsScreen />);

  await screen.findByText(CONNECTION_ERROR);
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await screen.findByText('카카오로 로그인됨');
});
