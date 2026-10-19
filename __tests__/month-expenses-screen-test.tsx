import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import MonthStatsScreen from '@/app/expenses';
import { currentMonth, monthTitle, previousMonth } from '@/lib/month';

let mockFocusEffect: () => void = () => {};
let mockParams: { month?: string } = {};
const mockApi = { getMonthExpenses: jest.fn(), getMonthStats: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => {
      mockFocusEffect = effect;
      useEffect(() => effect(), [effect]);
    },
  };
});

const statsFor = (month: string, spentAmount = 26000) => ({
  month,
  budgetAmount: 300000,
  spentAmount,
  expenseCount: 2,
  usagePercent: 8.7,
  budgetBalanceAmount: 300000 - spentAmount,
  categories: [{ category: 'CAFE', spentAmount, expenseCount: 2, sharePercent: 100 }],
});
const EMPTY_PAGE = { items: [], nextCursor: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockApi.getMonthStats.mockImplementation((month: string) => Promise.resolve(statsFor(month)));
  mockApi.getMonthExpenses.mockResolvedValue(EMPTY_PAGE);
});

const MonthExpensesScreen = MonthStatsScreen;

test('opens on the current month with stats and the record button', async () => {
  await render(<MonthExpensesScreen />);

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenCalledWith(currentMonth());
  expect(mockApi.getMonthExpenses).toHaveBeenCalledWith(currentMonth(), undefined);
  screen.getByText(monthTitle(currentMonth()));
  screen.getByText('카페');
  expect(screen.getByRole('button', { name: '다음 달' }).props.accessibilityState?.disabled).toBe(true);
  screen.getByRole('button', { name: '지출 기록하기' });
});

test('record button opens the entry screen', async () => {
  await render(<MonthExpensesScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '지출 기록하기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses/new');
});

test('the previous month loads both APIs for that month without the record button', async () => {
  await render(<MonthExpensesScreen />);
  await screen.findByText('26,000원');

  await fireEvent.press(screen.getByRole('button', { name: '이전 달' }));

  const prev = previousMonth(currentMonth());
  await screen.findByText(monthTitle(prev));
  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith(prev);
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith(prev, undefined);
  expect(screen.queryByRole('button', { name: '지출 기록하기' })).toBeNull();
  expect(screen.getByRole('button', { name: '다음 달' }).props.accessibilityState?.disabled).toBeFalsy();
});

test('a month param opens that month and disables the previous arrow at the lower bound', async () => {
  mockParams = { month: '2000-01' };
  await render(<MonthExpensesScreen />);

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith('2000-01');
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith('2000-01', undefined);
  expect(screen.getByRole('button', { name: '이전 달' }).props.accessibilityState?.disabled).toBe(true);
});

test('an invalid or future month param is ignored', async () => {
  mockParams = { month: '2999-01' };
  await render(<MonthExpensesScreen />);

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith(currentMonth());
});

test('a failed list hides the stats and retry reloads both', async () => {
  mockApi.getMonthExpenses
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(EMPTY_PAGE);
  await render(<MonthExpensesScreen />);

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  expect(screen.queryByText('26,000원')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenCalledTimes(2);
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);
});

test('a late response for the month left behind never replaces the new month', async () => {
  const prev = previousMonth(currentMonth());
  let resolveCurrent: (v: unknown) => void = () => {};
  mockApi.getMonthStats.mockImplementation((month: string) =>
    month === currentMonth()
      ? new Promise((resolve) => (resolveCurrent = resolve))
      : Promise.resolve(statsFor(month, 7000)),
  );
  await render(<MonthExpensesScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '이전 달' }));
  await screen.findByText('7,000원');
  await act(async () => resolveCurrent(statsFor(currentMonth(), 99000)));

  screen.getByText('7,000원');
  expect(screen.queryByText('99,000원')).toBeNull();
  screen.getByText(monthTitle(prev));
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

  await fireEvent.press(screen.getByRole('button', { name: '라떼, 10월 17일 · 카페, 12,000원' }));

  expect(router.push).toHaveBeenCalledWith('/expenses/2');
});

test('shows rows with title, subtitle, and amount, then the end message', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({
    items: [{ id: 2, amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' }],
    nextCursor: null,
  });
  await render(<MonthExpensesScreen />);

  await screen.findByText('라떼');
  screen.getByText('10월 17일 · 카페');
  screen.getByText('12,000원');
  screen.getByText('전체 내역');
  screen.getByText('모든 내역을 불러왔어요');
});
