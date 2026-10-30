import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import MonthStatsScreen from '@/app/expenses';
import { currentMonth, formatDay, monthTitle, previousMonth, todayInSeoul } from '@/lib/month';

// The screen registers several focus effects; a regained focus runs all of them.
const mockFocusEffects = new Set<() => void>();
const mockFocusEffect = () => mockFocusEffects.forEach((effect) => effect());
let mockParams: { month?: string } = {};
const mockApi = {
  getMonthExpenses: jest.fn(),
  getMonthStats: jest.fn(),
  getCategoryGoals: jest.fn(),
  getDailyTotals: jest.fn(),
};

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), setParams: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => {
      useEffect(() => {
        mockFocusEffects.add(effect);
        effect();
        return () => {
          mockFocusEffects.delete(effect);
        };
      }, [effect]);
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
const goalsFor = (month: string) => ({
  month,
  budgetAmount: 300000,
  goalTotalAmount: 150000,
  goalsExceedBudget: false,
  goals: [{ category: 'FOOD', goalAmount: 150000, spentAmount: 120000, remainingAmount: 30000, usagePercent: 80 }],
});
const EMPTY_PAGE = { items: [], nextCursor: null };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockApi.getMonthStats.mockImplementation((month: string) => Promise.resolve(statsFor(month)));
  mockApi.getMonthExpenses.mockResolvedValue(EMPTY_PAGE);
  mockApi.getCategoryGoals.mockImplementation((month: string) => Promise.resolve(goalsFor(month)));
  mockApi.getDailyTotals.mockImplementation((month: string) => Promise.resolve({ month, days: [] }));
});

test('opens on the current month with stats and the record button', async () => {
  await render(<MonthStatsScreen />);

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenCalledWith(currentMonth());
  expect(mockApi.getMonthExpenses).toHaveBeenCalledWith(currentMonth(), undefined);
  screen.getByText(monthTitle(currentMonth()));
  screen.getByText('카페');
  expect(screen.getByRole('button', { name: '다음 달' }).props.accessibilityState?.disabled).toBe(true);
  screen.getByRole('button', { name: '지출 기록하기' });
});

test('record button opens the entry screen', async () => {
  await render(<MonthStatsScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '지출 기록하기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses/new');
});

test('the previous month loads both APIs for that month without the record button', async () => {
  await render(<MonthStatsScreen />);
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
  await render(<MonthStatsScreen />);

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith('2000-01');
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith('2000-01', undefined);
  expect(screen.getByRole('button', { name: '이전 달' }).props.accessibilityState?.disabled).toBe(true);
});

test('an invalid or future month param is ignored', async () => {
  mockParams = { month: '2999-01' };
  await render(<MonthStatsScreen />);

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith(currentMonth());
});

test('a failed list hides the stats and retry reloads both', async () => {
  mockApi.getMonthExpenses
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(EMPTY_PAGE);
  await render(<MonthStatsScreen />);

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
  await render(<MonthStatsScreen />);

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
  await render(<MonthStatsScreen />);
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
  await render(<MonthStatsScreen />);
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
  await render(<MonthStatsScreen />);
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
  await render(<MonthStatsScreen />);
  await screen.findByText('라떼');

  await fireEvent.press(screen.getByRole('button', { name: '라떼, 10월 17일 · 카페, 12,000원' }));

  expect(router.push).toHaveBeenCalledWith('/expenses/2');
});

test('shows rows with title, subtitle, and amount, then the end message', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({
    items: [{ id: 2, amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' }],
    nextCursor: null,
  });
  await render(<MonthStatsScreen />);

  await screen.findByText('라떼');
  screen.getByText('10월 17일 · 카페');
  screen.getByText('12,000원');
  screen.getByText('전체 내역');
  screen.getByText('모든 내역을 불러왔어요');
});

test('a month param changing after mount loads that month', async () => {
  const view = await render(<MonthStatsScreen />);
  await screen.findByText('26,000원');

  mockParams = { month: '2026-09' };
  await view.rerender(<MonthStatsScreen />);

  await screen.findByText(monthTitle('2026-09'));
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith('2026-09');
  expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith('2026-09', undefined);
});

test('the month param is consumed so the same month can be requested again', async () => {
  mockParams = { month: '2026-09' };
  const view = await render(<MonthStatsScreen />);
  await screen.findByText(monthTitle('2026-09'));
  expect(router.setParams).toHaveBeenCalledWith({ month: undefined });

  mockParams = {};
  await view.rerender(<MonthStatsScreen />);
  await fireEvent.press(screen.getByRole('button', { name: '이전 달' }));
  await screen.findByText(monthTitle('2026-08'));

  mockParams = { month: '2026-09' };
  await view.rerender(<MonthStatsScreen />);
  await screen.findByText(monthTitle('2026-09'));
  expect(mockApi.getMonthStats).toHaveBeenLastCalledWith('2026-09');
});

test('regaining focus reloads both APIs', async () => {
  await render(<MonthStatsScreen />);
  await screen.findByText('26,000원');

  await act(async () => mockFocusEffect());

  await screen.findByText('26,000원');
  expect(mockApi.getMonthStats).toHaveBeenCalledTimes(2);
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);
});

test('shows the goals card for the month', async () => {
  await render(<MonthStatsScreen />);

  await screen.findByText('카테고리 목표');
  screen.getByText('30,000원 남음');
  expect(mockApi.getCategoryGoals).toHaveBeenCalledWith(currentMonth());
});

test('a failed goals request shows the error and retry reloads all three', async () => {
  mockApi.getCategoryGoals
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockImplementation((month: string) => Promise.resolve(goalsFor(month)));
  await render(<MonthStatsScreen />);

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await screen.findByText('카테고리 목표');
  expect(mockApi.getMonthStats).toHaveBeenCalledTimes(2);
  expect(mockApi.getMonthExpenses).toHaveBeenCalledTimes(2);
  expect(mockApi.getCategoryGoals).toHaveBeenCalledTimes(2);
});

test('a late goals response for the month left behind is never shown', async () => {
  let resolveCurrent: (v: unknown) => void = () => {};
  mockApi.getCategoryGoals.mockImplementation((month: string) =>
    month === currentMonth()
      ? new Promise((resolve) => (resolveCurrent = resolve))
      : Promise.resolve({ ...goalsFor(month), goals: [{ category: 'FOOD', goalAmount: 90000, spentAmount: 1000, remainingAmount: 89000, usagePercent: 1 }] }),
  );
  await render(<MonthStatsScreen />);

  await fireEvent.press(screen.getByRole('button', { name: '이전 달' }));
  await screen.findByText('89,000원 남음');
  await act(async () => resolveCurrent(goalsFor(currentMonth())));

  screen.getByText('89,000원 남음');
  expect(screen.queryByText('30,000원 남음')).toBeNull();
});

test('the budget row opens the budget screen for the shown month', async () => {
  await render(<MonthStatsScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: /예산 300,000원, 고치기/ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/budget', params: { month: currentMonth() } });
});

test('goal edit and category rows navigate with month and category', async () => {
  await render(<MonthStatsScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '카테고리 목표 고치기' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/goals', params: { month: currentMonth() } });

  await fireEvent.press(screen.getByRole('button', { name: /^식비, 목표/ }));
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/expenses/by-category',
    params: { month: currentMonth(), category: 'FOOD' },
  });
});

describe('calendar tab', () => {
  const SEPT_TOTALS = {
    month: '2026-09',
    days: [
      { date: '2026-09-01', spentAmount: 800, expenseCount: 1 },
      { date: '2026-09-28', spentAmount: 23000, expenseCount: 2 },
    ],
  };
  const lunch = { id: 7, amount: 15000, expenseDate: '2026-09-28', category: 'FOOD', memo: '점심' };

  function dayPage(date?: string) {
    return date === '2026-09-28' ? { items: [lunch], nextCursor: null } : EMPTY_PAGE;
  }

  async function openSeptemberCalendar() {
    mockParams = { month: '2026-09' };
    mockApi.getDailyTotals.mockImplementation((month: string) =>
      Promise.resolve(month === '2026-09' ? SEPT_TOTALS : { month, days: [] }),
    );
    mockApi.getMonthExpenses.mockImplementation((_m: string, _c?: string, _cat?: string, date?: string) =>
      Promise.resolve(dayPage(date)),
    );
    await render(<MonthStatsScreen />);
    await screen.findByText('26,000원');
    await fireEvent.press(screen.getByRole('tab', { name: '달력' }));
    await screen.findByText('9월 1일 · 800원');
  }

  test('opens on the list and loads the calendar only when its tab is chosen', async () => {
    await render(<MonthStatsScreen />);
    await screen.findByText('전체 내역');
    expect(screen.getByRole('tab', { name: '목록' }).props.accessibilityState?.selected).toBe(true);
    expect(mockApi.getDailyTotals).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('tab', { name: '달력' }));

    // This month starts on today.
    const today = todayInSeoul();
    await screen.findByText(formatDay(today));
    expect(mockApi.getDailyTotals).toHaveBeenCalledWith(currentMonth());
    expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith(currentMonth(), undefined, undefined, today);
    expect(screen.getByRole('button', { name: new RegExp(`^${formatDay(today)}, 오늘`) }).props.accessibilityState?.selected).toBe(true);
    screen.getByText('이날은 지출이 없어요');
    expect(screen.queryByText('전체 내역')).toBeNull();
  });

  test('a past month starts on the 1st and shortens day totals in the cells', async () => {
    await openSeptemberCalendar();

    expect(screen.getByRole('button', { name: '9월 1일, 800원' }).props.accessibilityState?.selected).toBe(true);
    screen.getByText('800');
    screen.getByText('2.3만');
    screen.getByRole('button', { name: '9월 2일, 지출 없음' });
    expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith('2026-09', undefined, undefined, '2026-09-01');
  });

  test('picking a day shows its total and expenses without reloading the calendar', async () => {
    await openSeptemberCalendar();

    await fireEvent.press(screen.getByRole('button', { name: '9월 28일, 23,000원' }));

    await screen.findByText('9월 28일 · 23,000원');
    screen.getByRole('button', { name: /15,000원$/ });
    expect(mockApi.getMonthExpenses).toHaveBeenLastCalledWith('2026-09', undefined, undefined, '2026-09-28');
    expect(mockApi.getDailyTotals).toHaveBeenCalledTimes(1);
  });

  test('changing the month picks the default day again', async () => {
    await openSeptemberCalendar();
    await fireEvent.press(screen.getByRole('button', { name: '9월 28일, 23,000원' }));
    await screen.findByText('9월 28일 · 23,000원');

    await fireEvent.press(screen.getByRole('button', { name: '이전 달' }));
    await screen.findByText('8월 1일');
    await fireEvent.press(screen.getByRole('button', { name: '다음 달' }));

    await screen.findByText('9월 1일 · 800원');
    expect(mockApi.getDailyTotals).toHaveBeenLastCalledWith('2026-09');
  });

  test('returning from an edit reloads the totals and the day, keeping the picked day and tab', async () => {
    await openSeptemberCalendar();
    await fireEvent.press(screen.getByRole('button', { name: '9월 28일, 23,000원' }));
    await fireEvent.press(await screen.findByRole('button', { name: /15,000원$/ }));
    expect(router.push).toHaveBeenCalledWith('/expenses/7');
    const statsCalls = mockApi.getMonthStats.mock.calls.length;

    // The expense moved to another day.
    mockApi.getDailyTotals.mockResolvedValue({ ...SEPT_TOTALS, days: [{ date: '2026-09-28', spentAmount: 8000, expenseCount: 1 }] });
    mockApi.getMonthExpenses.mockResolvedValue(EMPTY_PAGE);
    await act(async () => mockFocusEffect());

    await screen.findByText('9월 28일 · 8,000원');
    screen.getByText('이날은 지출이 없어요');
    expect(mockApi.getDailyTotals).toHaveBeenCalledTimes(2);
    expect(mockApi.getMonthStats).toHaveBeenCalledTimes(statsCalls);
  });

  test('saving an edit returns with the month param and keeps the picked day', async () => {
    await openSeptemberCalendar();
    // The screen consumed the opening param.
    mockParams = {};
    await screen.rerender(<MonthStatsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: '9월 28일, 23,000원' }));
    await screen.findByText('9월 28일 · 23,000원');

    // The edit screen dismisses back with params { month: savedMonth }.
    mockParams = { month: '2026-09' };
    await screen.rerender(<MonthStatsScreen />);
    await act(async () => mockFocusEffect());

    await screen.findByText('9월 28일 · 23,000원');
    expect(screen.getByRole('button', { name: '9월 28일, 23,000원' }).props.accessibilityState?.selected).toBe(true);
    expect(screen.getByRole('tab', { name: '달력' }).props.accessibilityState?.selected).toBe(true);
  });

  test('a failed day list keeps the calendar and retries only that day', async () => {
    await openSeptemberCalendar();
    mockApi.getMonthExpenses.mockRejectedValueOnce(new TypeError('Network request failed'));

    await fireEvent.press(screen.getByRole('button', { name: '9월 28일, 23,000원' }));
    await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

    await screen.findByRole('button', { name: /15,000원$/ });
    screen.getByText('9월 28일 · 23,000원');
    expect(mockApi.getDailyTotals).toHaveBeenCalledTimes(1);
  });

  test('a failed calendar load offers a retry', async () => {
    mockApi.getDailyTotals.mockRejectedValueOnce(new TypeError('Network request failed'));
    await render(<MonthStatsScreen />);
    await screen.findByText('전체 내역');
    await fireEvent.press(screen.getByRole('tab', { name: '달력' }));

    await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

    await screen.findByText(formatDay(todayInSeoul()));
    expect(mockApi.getDailyTotals).toHaveBeenCalledTimes(2);
  });
});
