import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import CategoryExpensesScreen from '@/app/expenses/by-category';
import { currentMonth, monthName, previousMonth } from '@/lib/month';

let mockParams: { month?: string; category?: string } = {};
const mockApi = { getMonthExpenses: jest.fn(), getMonthStats: jest.fn(), getCategoryGoals: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

const month = previousMonth(currentMonth());
const statsFor = (m: string, categories = [{ category: 'CAFE', spentAmount: 62000, expenseCount: 3, sharePercent: 100 }]) => ({
  month: m,
  budgetAmount: 300000,
  spentAmount: 62000,
  expenseCount: 3,
  usagePercent: 20,
  budgetBalanceAmount: 238000,
  categories,
});
const goalsFor = (m: string, goals: object[] = [{ category: 'CAFE', goalAmount: 50000, spentAmount: 62000, remainingAmount: -12000, usagePercent: 124 }]) => ({
  month: m,
  budgetAmount: 300000,
  goalTotalAmount: 50000,
  goalsExceedBudget: false,
  goals,
});
const row = (id: number, memo: string) => ({ id, amount: 1000, expenseDate: `${month}-17`, category: 'CAFE', memo });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { month, category: 'CAFE' };
  mockApi.getMonthStats.mockImplementation((m: string) => Promise.resolve(statsFor(m)));
  mockApi.getMonthExpenses.mockResolvedValue({ items: [], nextCursor: null });
  mockApi.getCategoryGoals.mockImplementation((m: string) => Promise.resolve(goalsFor(m)));
});

test('shows the title, spent amount, goal summary, and a category-filtered list', async () => {
  await render(<CategoryExpensesScreen />);

  await screen.findByText(`${monthName(month)} 카페`);
  screen.getByText('62,000원');
  screen.getByText('목표 50,000원 · 12,000원 초과');
  expect(mockApi.getMonthExpenses).toHaveBeenCalledWith(month, undefined, 'CAFE');
});

test('a category without stats shows 0원 and an empty list message; no goal hides the summary', async () => {
  mockApi.getMonthStats.mockImplementation((m: string) => Promise.resolve(statsFor(m, [])));
  mockApi.getCategoryGoals.mockImplementation((m: string) => Promise.resolve(goalsFor(m, [])));
  await render(<CategoryExpensesScreen />);

  await screen.findByText('이 달에 이 카테고리 지출이 없어요');
  screen.getByText('0원');
  expect(screen.queryByText(/목표/)).toBeNull();
});

test('loads the next page with the same category and ends with the end message', async () => {
  mockApi.getMonthExpenses
    .mockResolvedValueOnce({ items: [row(2, '둘')], nextCursor: 'n1' })
    .mockResolvedValueOnce({ items: [row(1, '하나')], nextCursor: null });
  await render(<CategoryExpensesScreen />);
  await screen.findByText('둘');

  await fireEvent(screen.getByTestId('expense-list'), 'endReached');

  await screen.findByText('하나');
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith(month, 'n1', 'CAFE');
  screen.getByText('모든 내역을 불러왔어요');
});

test('a failed request shows the connection error and retry reloads all three', async () => {
  mockApi.getCategoryGoals
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockImplementation((m: string) => Promise.resolve(goalsFor(m)));
  await render(<CategoryExpensesScreen />);

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await screen.findByText('62,000원');
  expect(mockApi.getMonthStats).toHaveBeenCalledTimes(2);
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);
  expect(mockApi.getCategoryGoals).toHaveBeenCalledTimes(2);
});

test.each([
  { month, category: 'COFFEE' },
  { month: '2999-01', category: 'CAFE' },
  { category: 'CAFE' },
])('invalid params %j show the invalid access screen without API calls', async (params) => {
  mockParams = params;
  await render(<CategoryExpensesScreen />);

  screen.getByText('잘못된 접근이에요');
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(mockApi.getMonthStats).not.toHaveBeenCalled();
  expect(mockApi.getMonthExpenses).not.toHaveBeenCalled();
  expect(mockApi.getCategoryGoals).not.toHaveBeenCalled();
});

test('pressing a row opens the expense edit screen flagged as coming from the category list', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({ items: [row(7, '라떼')], nextCursor: null });
  await render(<CategoryExpensesScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: `라떼, ${monthName(month)} 17일 · 카페, 1,000원` }));

  expect(router.push).toHaveBeenCalledWith({ pathname: '/expenses/[id]', params: { id: 7, from: 'category' } });
});
