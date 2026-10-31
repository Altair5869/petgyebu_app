import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import SettingsBudgetScreen from '@/app/settings/budget';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { currentMonth, monthTitle, previousMonth } from '@/lib/month';

let mockParams: { month?: string } = {};
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => mockParams }));
// The native stack header sits above the screen; its height offsets the keyboard avoidance.
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 116 }));
// Render the avoider as a plain view that keeps its props, so tests can read the offset.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => createElement(View, { ...props, testID: 'keyboard-avoiding' }) };
});

const mockApi = { getBudget: jest.fn(), putBudget: jest.fn() };
const mockRefreshStage = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
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

test('lifts the save button by the header height so the keypad does not cover it', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-10', amount: 300000 });
  await render(<SettingsBudgetScreen />);
  expect((await screen.findByTestId('keyboard-avoiding')).props.keyboardVerticalOffset).toBe(116);
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

test('ignores a late response for the month that was open before the month changed', async () => {
  let resolveOctober: (budget: { month: string; amount: number | null }) => void = () => {};
  mockApi.getBudget.mockImplementation((month: string) =>
    month === '2026-10'
      ? new Promise((resolve) => {
          resolveOctober = resolve;
        })
      : Promise.resolve({ month, amount: null }),
  );
  const view = await render(<SettingsBudgetScreen />);

  jest.setSystemTime(new Date('2026-11-01T00:00:01+09:00'));
  await view.rerender(<SettingsBudgetScreen />);
  await waitFor(() => expect(mockApi.getBudget).toHaveBeenCalledWith('2026-11'));
  await screen.findByLabelText('예산 금액');

  await act(async () => resolveOctober({ month: '2026-10', amount: 300000 }));
  expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('');
});

test('opens a past month from the month param and saves it', async () => {
  const past = previousMonth(currentMonth());
  mockParams = { month: past };
  mockApi.getBudget.mockResolvedValue({ month: past, amount: null });
  mockApi.putBudget.mockResolvedValue({ month: past, amount: 250000 });
  await render(<SettingsBudgetScreen />);

  await fireEvent.changeText(await screen.findByLabelText('예산 금액'), '250000');
  expect(screen.getByText(`${monthTitle(past)} 예산`)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockApi.getBudget).toHaveBeenCalledWith(past);
  expect(mockApi.putBudget).toHaveBeenCalledWith(past, 250000);
});

test('shows the server month message for a past month instead of refreshing the stage', async () => {
  const past = previousMonth(currentMonth());
  mockParams = { month: past };
  mockApi.getBudget.mockResolvedValue({ month: past, amount: 300000 });
  mockApi.putBudget.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'month', message: '수정할 수 없는 달이에요' }]),
  );
  await render(<SettingsBudgetScreen />);

  await fireEvent.changeText(await screen.findByLabelText('예산 금액'), '450000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('수정할 수 없는 달이에요');
  expect(mockRefreshStage).not.toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
});

test.each(['2099-01', 'abc'])('ignores a future or malformed month param (%s)', async (value) => {
  mockParams = { month: value };
  mockApi.getBudget.mockResolvedValue({ month: currentMonth(), amount: null });
  await render(<SettingsBudgetScreen />);

  await screen.findByLabelText('예산 금액');
  expect(mockApi.getBudget).toHaveBeenCalledWith(currentMonth());
});
