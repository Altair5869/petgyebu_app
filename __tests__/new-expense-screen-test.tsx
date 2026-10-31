import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Keyboard } from 'react-native';

import { ApiError, RequestTimeoutError } from '@/api/client';
import NewExpenseScreen from '@/app/expenses/new';
import { todayInSeoul } from '@/lib/month';

const mockApi = { createExpense: jest.fn() };
const mockRandomUUID = jest.fn();

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

// The native stack header sits above the screen; its height offsets the keyboard avoidance.
jest.mock('expo-router/react-navigation', () => ({ useHeaderHeight: () => 116 }));
// Render the avoider as a plain view that keeps its props, so tests can read the offset.
jest.mock('react-native/Libraries/Components/Keyboard/KeyboardAvoidingView', () => {
  const { createElement } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (props: object) => createElement(View, { ...props, testID: 'keyboard-avoiding' }) };
});

// The SwiftUI picker is native; render its value so tests can see it.
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { createElement } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { testID?: string; value: Date; onValueChange: (e: unknown, d: Date) => void }) =>
      createElement(
        Text,
        {
          testID: props.testID,
          onPress: () =>
            props.onValueChange(
              { nativeEvent: { timestamp: 0, utcOffset: 0 } },
              jest.requireActual('@/lib/month').seoulDayToDate('2026-09-30'),
            ),
        },
        props.value.toISOString(),
      ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.createExpense.mockResolvedValue({ id: 1 });
  let n = 0;
  mockRandomUUID.mockImplementation(() => `k${++n}`);
});

async function fillAmount(value: string) {
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), value);
}

test('saves today as OTHER with a null memo by default and goes back', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith(
    { amount: 12000, expenseDate: todayInSeoul(), category: 'OTHER', memo: null },
    'k1',
  );
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('sends the chosen category and memo', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.changeText(screen.getByLabelText('메모'), '라떼');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.createExpense).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'CAFE', memo: '라떼' }), expect.any(String));
});

test('sends OTHER after a category is selected and then unselected', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('5000');
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.createExpense).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'OTHER' }), expect.any(String));
});

test('sends a whitespace-only memo as null', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('3000');
  await fireEvent.changeText(screen.getByLabelText('메모'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith(expect.objectContaining({ memo: null }), expect.any(String));
});

test('disables saving for an empty amount or a 101-character memo', async () => {
  await render(<NewExpenseScreen />);
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  screen.getByText('금액을 입력해 주세요');

  await fillAmount('1000');
  await fireEvent.changeText(screen.getByLabelText('메모'), '가'.repeat(101));
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  screen.getByText('메모는 100자까지 입력할 수 있어요');
});

test('shows server field errors and keeps the input', async () => {
  mockApi.createExpense.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'expenseDate', message: '미래 날짜는 입력할 수 없어요' }]),
  );
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('미래 날짜는 입력할 수 없어요');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('12,000');
  expect(router.back).not.toHaveBeenCalled();
});

test('shows the connection message on a network error', async () => {
  mockApi.createExpense.mockRejectedValue(new TypeError('Network request failed'));
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('12,000');
});

test('a timeout says the save could not be confirmed and keeps the input', async () => {
  mockApi.createExpense.mockRejectedValue(new RequestTimeoutError());
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('저장됐는지 확인하지 못했어요. 다시 저장해도 한 번만 기록돼요.');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('12,000');
  expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  expect(router.back).not.toHaveBeenCalled();
});

test('sends one request when save is pressed twice', async () => {
  mockApi.createExpense.mockReturnValue(new Promise(() => {}));
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  const save = screen.getByRole('button', { name: '저장' });
  await fireEvent.press(save);
  await fireEvent.press(save);

  expect(mockApi.createExpense).toHaveBeenCalledTimes(1);
});

test('sends the day chosen in the date picker', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByTestId('expense-date'));
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith(expect.objectContaining({ expenseDate: '2026-09-30' }), expect.any(String));
});

test('clears a server field error when that field is edited', async () => {
  mockApi.createExpense.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'expenseDate', message: '미래 날짜는 입력할 수 없어요' }]),
  );
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('미래 날짜는 입력할 수 없어요');

  await fireEvent.press(screen.getByTestId('expense-date'));
  expect(screen.queryByText('미래 날짜는 입력할 수 없어요')).toBeNull();
});

test('shows the generic message when the server reports only unknown fields', async () => {
  mockApi.createExpense.mockRejectedValue(new ApiError(400, 'INVALID_REQUEST', [{ field: 'unknown', message: 'x' }]));
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  expect(screen.queryByText('x')).toBeNull();
});

test('retrying the same input after a timeout reuses the key', async () => {
  mockApi.createExpense.mockRejectedValueOnce(new RequestTimeoutError());
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('저장됐는지 확인하지 못했어요. 다시 저장해도 한 번만 기록돼요.');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledTimes(2);
  expect(mockApi.createExpense.mock.calls.map((c) => c[1])).toEqual(['k1', 'k1']);
});

test('changing the amount after a timeout uses a new key', async () => {
  mockApi.createExpense.mockRejectedValueOnce(new RequestTimeoutError());
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  await screen.findByText('저장됐는지 확인하지 못했어요. 다시 저장해도 한 번만 기록돼요.');
  await fillAmount('13000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense.mock.calls.map((c) => c[1])).toEqual(['k1', 'k2']);
});

test('a reused-key conflict shows the conflict copy', async () => {
  mockApi.createExpense.mockRejectedValue(new ApiError(409, 'IDEMPOTENCY_KEY_REUSED'));
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('이미 저장된 기록과 내용이 달라요. 월별 통계에서 확인해 주세요.');
  expect(router.back).not.toHaveBeenCalled();
});

test('lifts the save footer by the header height so the keypad does not cover it', async () => {
  await render(<NewExpenseScreen />);
  expect(screen.getByTestId('keyboard-avoiding').props.keyboardVerticalOffset).toBe(116);
});

test('keeps the date caption out of the Android reader, since the date button already says 날짜', async () => {
  await render(<NewExpenseScreen />);
  expect(screen.getByText('날짜').props.importantForAccessibility).toBe('no');
});

test('choosing a category closes the number pad, which has no close key', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss');
  await render(<NewExpenseScreen />);
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  expect(dismiss).toHaveBeenCalledTimes(1);
});

test('an amount event from before a category tap keeps the chosen category', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('700');
  // Hold the handler from before the tap, as a late native text event would still carry it.
  const lateAmountChange = screen.getByLabelText('지출 금액').props.onChangeText as (t: string) => void;
  await fireEvent.press(screen.getByRole('radio', { name: '식비' }));
  await act(() => lateAmountChange('7000'));
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenLastCalledWith(
    expect.objectContaining({ amount: 7000, category: 'FOOD' }),
    expect.any(String),
  );
});
