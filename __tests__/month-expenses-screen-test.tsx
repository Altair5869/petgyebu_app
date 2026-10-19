import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import MonthExpensesScreen from '@/app/expenses';
import { currentMonth } from '@/lib/month';

let mockFocusEffect: () => void = () => {};
const mockApi = { getMonthExpenses: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => {
      mockFocusEffect = effect;
      useEffect(() => effect(), [effect]);
    },
  };
});

beforeEach(() => jest.clearAllMocks());

test('shows rows with title, subtitle, and amount, then the end message', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({
    items: [
      { id: 2, amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' },
      { id: 1, amount: 5000, expenseDate: '2026-10-07', category: 'OTHER', memo: null },
    ],
    nextCursor: null,
  });
  await render(<MonthExpensesScreen />);

  await screen.findByText('라떼');
  screen.getByText('10월 17일 · 카페');
  screen.getByText('12,000원');
  screen.getByText('기타');
  screen.getByText('10월 7일');
  screen.getByText('모든 내역을 불러왔어요');
});

test('shows the empty state with a record button', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({ items: [], nextCursor: null });
  await render(<MonthExpensesScreen />);

  await screen.findByText('아직 기록한 지출이 없어요');
  expect(screen.queryByText('모든 내역을 불러왔어요')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '지출 기록하기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses/new');
});

test('offers a retry when the first page fails', async () => {
  mockApi.getMonthExpenses
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  await render(<MonthExpensesScreen />);

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await screen.findByText('아직 기록한 지출이 없어요');
});

const row = (id: number, memo: string) => ({
  id,
  amount: 1000,
  expenseDate: '2026-10-17',
  category: 'CAFE',
  memo,
});

test('loads the next page when the list end is reached', async () => {
  mockApi.getMonthExpenses
    .mockResolvedValueOnce({ items: [row(2, '둘')], nextCursor: 'c1' })
    .mockResolvedValueOnce({ items: [row(1, '하나')], nextCursor: null });
  await render(<MonthExpensesScreen />);
  await screen.findByText('둘');

  await fireEvent(screen.getByTestId('expense-list'), 'endReached');

  await screen.findByText('하나');
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith(currentMonth(), 'c1');
  screen.getByText('둘');
});

test('retries a failed next page only from the footer button', async () => {
  mockApi.getMonthExpenses
    .mockResolvedValueOnce({ items: [row(2, '둘')], nextCursor: 'c1' })
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce({ items: [row(1, '하나')], nextCursor: null });
  await render(<MonthExpensesScreen />);
  await screen.findByText('둘');

  await fireEvent(screen.getByTestId('expense-list'), 'endReached');
  await screen.findByRole('button', { name: '다시 시도' });
  screen.getByText('둘');
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);

  await fireEvent(screen.getByTestId('expense-list'), 'endReached');
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);

  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByText('하나');
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith(currentMonth(), 'c1');
});

test('reloads from the first page when the screen regains focus', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({ items: [row(1, '하나')], nextCursor: null });
  await render(<MonthExpensesScreen />);
  await screen.findByText('하나');

  await act(async () => mockFocusEffect());

  await screen.findByText('하나');
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith(currentMonth(), undefined);
});

test('tapping a row opens its edit screen', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({
    items: [{ id: 2, amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' }],
    nextCursor: null,
  });
  await render(<MonthExpensesScreen />);
  await screen.findByText('라떼');

  await fireEvent.press(screen.getByRole('button', { name: '라떼, 12,000원' }));

  expect(router.push).toHaveBeenCalledWith('/expenses/2');
});
