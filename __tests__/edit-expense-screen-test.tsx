import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { ApiError } from '@/api/client';
import EditExpenseScreen from '@/app/expenses/[id]';
import { currentMonth, seoulDayToDate, todayInSeoul } from '@/lib/month';

const mockApi = { getExpense: jest.fn(), updateExpense: jest.fn(), deleteExpense: jest.fn() };
const mockPicker = jest.fn();
let mockPickedDay: string | null = null;

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() },
  useLocalSearchParams: () => ({ id: '7' }),
}));

// The SwiftUI picker is native; render its value so tests can see it.
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { createElement } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: {
      testID?: string;
      value: Date;
      minimumDate: Date;
      onValueChange: (e: unknown, d: Date) => void;
    }) => {
      mockPicker(props);
      return createElement(
        Text,
        {
          testID: props.testID,
          onPress: () =>
            props.onValueChange(
              { nativeEvent: { timestamp: 0, utcOffset: 0 } },
              jest
                .requireActual('@/lib/month')
                .seoulDayToDate(mockPickedDay ?? `${jest.requireActual('@/lib/month').currentMonth()}-03`),
            ),
        },
        props.value.toISOString(),
      );
    },
  };
});

const day17 = `${currentMonth()}-17`;
const thisMonthDay = day17 < todayInSeoul() ? day17 : todayInSeoul();
const loaded = { id: 7, amount: 12000, expenseDate: thisMonthDay, category: 'CAFE', memo: '라떼' };
const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockPickedDay = null;
  mockApi.getExpense.mockResolvedValue(loaded);
  mockApi.updateExpense.mockResolvedValue(loaded);
  mockApi.deleteExpense.mockResolvedValue(undefined);
});

async function renderReady() {
  await render(<EditExpenseScreen />);
  await screen.findByLabelText('지출 금액');
}

function confirmDelete() {
  const buttons = alertSpy.mock.calls[0][2]!;
  return buttons.find((b) => b.style === 'destructive')!;
}

test('fills the loaded values and disables save until something changes', async () => {
  await renderReady();
  expect(mockApi.getExpense).toHaveBeenCalledWith(7);
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('12,000');
  expect(screen.getByLabelText('메모')).toHaveDisplayValue('라떼');
  expect(screen.getByRole('radio', { name: '카페' })).toBeSelected();
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('sends only the changed amount and returns to that month', async () => {
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.updateExpense).toHaveBeenCalledWith(7, { amount: 7000 });
  expect(router.dismissTo).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).toHaveBeenCalledWith({
    pathname: '/expenses',
    params: { month: currentMonth() },
  });
  expect(router.back).not.toHaveBeenCalled();
});

test('clearing the memo sends memo null', async () => {
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('메모'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.updateExpense).toHaveBeenCalledWith(7, { memo: null });
});

test('tapping the selected category keeps it selected', async () => {
  await renderReady();
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));

  expect(screen.getByRole('radio', { name: '카페' })).toBeSelected();
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('date picker allows any month since 2000', async () => {
  await renderReady();
  expect(mockPicker).toHaveBeenLastCalledWith(
    expect.objectContaining({ minimumDate: seoulDayToDate('2000-01-01') }),
  );
});

test('shows server field errors and keeps input', async () => {
  mockApi.updateExpense.mockRejectedValue(new ApiError(400, 'INVALID_REQUEST', [{ field: 'amount', message: '금액 오류' }]));
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('금액 오류');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('7,000');
});

test('connection error on save keeps input and retry sends the same body', async () => {
  mockApi.updateExpense.mockRejectedValueOnce(new TypeError('Network request failed'));
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('7,000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.updateExpense).toHaveBeenCalledTimes(2);
  expect(mockApi.updateExpense.mock.calls[1]).toEqual(mockApi.updateExpense.mock.calls[0]);
});

test('double tap on save sends one request', async () => {
  mockApi.updateExpense.mockReturnValue(new Promise(() => {}));
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  const save = screen.getByRole('button', { name: '저장' });
  await fireEvent.press(save);
  await fireEvent.press(save);

  expect(mockApi.updateExpense).toHaveBeenCalledTimes(1);
});

test('not found on load', async () => {
  mockApi.getExpense.mockRejectedValue(new ApiError(404, 'EXPENSE_NOT_FOUND', []));
  await render(<EditExpenseScreen />);

  await screen.findByText('이미 삭제된 지출이에요');
  await fireEvent.press(screen.getByRole('button', { name: '내역으로' }));
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('not found on save', async () => {
  mockApi.updateExpense.mockRejectedValue(new ApiError(404, 'EXPENSE_NOT_FOUND', []));
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('이미 삭제된 지출이에요');
  expect(screen.getByRole('button', { name: '내역으로' })).toBeTruthy();
});

test('load failure then retry', async () => {
  mockApi.getExpense.mockRejectedValueOnce(new TypeError('Network request failed'));
  await render(<EditExpenseScreen />);

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByLabelText('지출 금액');
  expect(mockApi.getExpense).toHaveBeenCalledTimes(2);
});

test('opens a past-month expense for editing', async () => {
  mockApi.getExpense.mockResolvedValue({ ...loaded, expenseDate: '2026-09-30' });
  await renderReady();

  expect(screen.queryByText('지난달 지출은 아직 고칠 수 없어요')).toBeNull();
});

test('saving into another month returns to that month', async () => {
  mockPickedDay = '2026-09-30';
  mockApi.updateExpense.mockResolvedValue({ ...loaded, expenseDate: '2026-09-30' });
  await renderReady();
  await fireEvent.press(screen.getByTestId('expense-date'));
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(router.dismissTo).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/expenses', params: { month: '2026-09' } });
});

test('saving within the same past month keeps that month', async () => {
  mockApi.getExpense.mockResolvedValue({ ...loaded, expenseDate: '2026-09-15' });
  mockApi.updateExpense.mockResolvedValue({ ...loaded, expenseDate: '2026-09-15', amount: 7000 });
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.updateExpense).toHaveBeenCalledWith(7, { amount: 7000 });
  expect(router.dismissTo).toHaveBeenCalledWith({ pathname: '/expenses', params: { month: '2026-09' } });
});

test('cancel in the delete confirm sends nothing', async () => {
  await renderReady();
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));

  expect(alertSpy).toHaveBeenCalledWith('이 지출을 삭제할까요?', undefined, expect.any(Array));
  const cancel = alertSpy.mock.calls[0][2]!.find((b) => b.style === 'cancel')!;
  expect(cancel.onPress).toBeUndefined();
  expect(mockApi.deleteExpense).not.toHaveBeenCalled();
});

test('confirm delete calls DELETE and goes back', async () => {
  await renderReady();
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
  await act(async () => confirmDelete().onPress!());

  expect(mockApi.deleteExpense).toHaveBeenCalledWith(7);
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('delete not found still goes back', async () => {
  mockApi.deleteExpense.mockRejectedValue(new ApiError(404, 'EXPENSE_NOT_FOUND', []));
  await renderReady();
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
  await act(async () => confirmDelete().onPress!());

  expect(router.back).toHaveBeenCalledTimes(1);
});

test('delete failure shows the connection error and stays', async () => {
  mockApi.deleteExpense.mockRejectedValue(new TypeError('Network request failed'));
  await renderReady();
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
  await act(async () => confirmDelete().onPress!());

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  expect(router.back).not.toHaveBeenCalled();
  expect(screen.getByLabelText('지출 금액')).toBeTruthy();
});

test('confirming delete twice sends one request', async () => {
  mockApi.deleteExpense.mockReturnValue(new Promise(() => {}));
  await renderReady();
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
  const { onPress } = confirmDelete();
  await act(async () => onPress!());
  await act(async () => onPress!());

  expect(mockApi.deleteExpense).toHaveBeenCalledTimes(1);
});

test('after a successful save the buttons stay disabled and a second tap sends nothing', async () => {
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.updateExpense).toHaveBeenCalledTimes(1);
  expect(router.dismissTo).toHaveBeenCalledTimes(1);
});

test('after a successful delete the buttons stay disabled and a second confirm sends nothing', async () => {
  await renderReady();
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
  const { onPress } = confirmDelete();
  await act(async () => onPress!());

  expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled();
  await act(async () => onPress!());
  expect(mockApi.deleteExpense).toHaveBeenCalledTimes(1);
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('while a save is in flight delete is disabled and opens no confirm', async () => {
  mockApi.updateExpense.mockReturnValue(new Promise(() => {}));
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  const del = screen.getByRole('button', { name: '삭제' });
  expect(del).toBeDisabled();
  await fireEvent.press(del);
  expect(alertSpy).not.toHaveBeenCalled();
  expect(mockApi.deleteExpense).not.toHaveBeenCalled();
});

test('while a delete is in flight save is disabled', async () => {
  mockApi.deleteExpense.mockReturnValue(new Promise(() => {}));
  await renderReady();
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), '7000');
  await fireEvent.press(screen.getByRole('button', { name: '삭제' }));
  await act(async () => confirmDelete().onPress!());

  const save = screen.getByRole('button', { name: '저장' });
  expect(save).toBeDisabled();
  await fireEvent.press(save);
  expect(mockApi.updateExpense).not.toHaveBeenCalled();
});
