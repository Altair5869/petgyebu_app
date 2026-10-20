import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import SettingsBudgetScreen from '@/app/settings/budget';
import { CONNECTION_ERROR } from '@/lib/error-message';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const mockApi = { getBudget: jest.fn(), putBudget: jest.fn() };
const mockRefreshStage = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: new Date('2026-10-15T12:00:00+09:00') });
  mockRefreshStage.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test('fills the input with the current month budget', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
  await render(<SettingsBudgetScreen />);

  await waitFor(() => expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('300,000'));
  expect(mockApi.getBudget).toHaveBeenCalledWith('2026-10');
});

test('saves the current month and goes back', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
  mockApi.putBudget.mockResolvedValue({ month: '2026-10', amount: 450000 });
  await render(<SettingsBudgetScreen />);

  await fireEvent.changeText(await screen.findByLabelText('예산 금액'), '450000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockApi.putBudget).toHaveBeenCalledWith('2026-10', 450000);
});

test('disables saving for zero', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
  await render(<SettingsBudgetScreen />);

  await fireEvent.changeText(await screen.findByLabelText('예산 금액'), '0');
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('re-checks the stage when the month rolled over', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
  mockApi.putBudget.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'month', message: '달이 바뀌었어요' }]),
  );
  await render(<SettingsBudgetScreen />);

  await fireEvent.changeText(await screen.findByLabelText('예산 금액'), '450000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await waitFor(() => expect(mockRefreshStage).toHaveBeenCalledTimes(1));
  expect(router.back).not.toHaveBeenCalled();
});

test('shows the server amount error', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
  mockApi.putBudget.mockRejectedValue(new ApiError(400, 'INVALID_REQUEST', [{ field: 'amount', message: 'X' }]));
  await render(<SettingsBudgetScreen />);

  await fireEvent.changeText(await screen.findByLabelText('예산 금액'), '450000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('X');
  expect(router.back).not.toHaveBeenCalled();
});

test('shows a retry when loading the budget fails', async () => {
  mockApi.getBudget.mockRejectedValueOnce(new TypeError('Network request failed'));
  mockApi.getBudget.mockResolvedValueOnce({ month: '2026-10', amount: 300000 });
  await render(<SettingsBudgetScreen />);

  await screen.findByText(CONNECTION_ERROR);
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await waitFor(() => expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('300,000'));
});
