import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError, RequestTimeoutError } from '@/api/client';
import NewExpenseScreen from '@/app/expenses/new';
import { todayInSeoul } from '@/lib/month';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
}));

const mockApi = { createExpense: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}));

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
});

async function fillAmount(value: string) {
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), value);
}

test('saves today as OTHER with a null memo by default and goes back', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith({
    amount: 12000,
    expenseDate: todayInSeoul(),
    category: 'OTHER',
    memo: null,
  });
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('sends the chosen category and memo', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.changeText(screen.getByLabelText('메모'), '라떼');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.createExpense).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'CAFE', memo: '라떼' }));
});

test('sends OTHER after a category is selected and then unselected', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('5000');
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.createExpense).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'OTHER' }));
});

test('sends a whitespace-only memo as null', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('3000');
  await fireEvent.changeText(screen.getByLabelText('메모'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith(expect.objectContaining({ memo: null }));
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

  await screen.findByText('저장됐는지 확인하지 못했어요. 월별 통계에서 확인해 주세요.');
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

  expect(mockApi.createExpense).toHaveBeenCalledWith(expect.objectContaining({ expenseDate: '2026-09-30' }));
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
