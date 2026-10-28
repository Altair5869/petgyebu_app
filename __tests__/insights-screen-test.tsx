import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import InsightsScreen from '@/app/insights';
import { CONNECTION_ERROR } from '@/lib/error-message';

const mockApi = { getInsights: jest.fn() };
let mockFocusEffect: (() => void) | undefined;

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (effect: () => void) => {
      mockFocusEffect = effect;
      useEffect(() => effect(), [effect]);
    },
  };
});

const WEEKLY = {
  thisWeek: { from: '2026-10-26', to: '2026-10-28' },
  lastWeek: { from: '2026-10-19', to: '2026-10-21' },
  categories: [
    { category: 'CAFE', thisWeekAmount: 21000, lastWeekAmount: 8000, changeAmount: 13000 },
    { category: 'TRANSPORT', thisWeekAmount: 5000, lastWeekAmount: 5000, changeAmount: 0 },
    { category: 'FOOD', thisWeekAmount: 12000, lastWeekAmount: 16000, changeAmount: -4000 },
  ],
};
const EXHAUST = {
  today: '2026-10-28',
  weekly: WEEKLY,
  forecast: { status: 'WILL_EXHAUST', dailyAverageAmount: 2392, exhaustionDate: '2026-10-30' },
};

beforeEach(() => jest.clearAllMocks());

test('shows forecast, headline, week ranges, rows, bars and legend', async () => {
  mockApi.getInsights.mockResolvedValue(EXHAUST);
  await render(<InsightsScreen />);

  await screen.findByText('이 속도면 10월 30일에 예산을 다 써요');
  screen.getByText('하루 평균 2,392원');
  expect(screen.getByTestId('weekly-headline')).toHaveTextContent('이번 주에는 지난주보다 카페에 13,000원 더 썼어요');
  screen.getByText('카테고리별 변화');
  screen.getByText('10월 26일~28일 vs 10월 19일~21일');
  const rows = screen.getAllByTestId(/^weekly-row-/).map((r) => r.props.testID);
  expect(rows).toEqual(['weekly-row-CAFE', 'weekly-row-TRANSPORT', 'weekly-row-FOOD']);
  expect(screen.getByTestId('weekly-row-CAFE').props.accessibilityLabel).toContain('카페, 이번 주 21,000원');
  screen.getByText('+13,000');
  screen.getByText('−4,000');
  expect(StyleSheet.flatten(screen.getByTestId('this-week-bar-CAFE').props.style).width).toBe('100%');
  screen.getByText('색 막대 이번 주 · 회색 막대 지난주');
});

test('empty weeks show the empty card and no category section', async () => {
  mockApi.getInsights.mockResolvedValue({
    ...EXHAUST,
    weekly: { ...WEEKLY, categories: [] },
    forecast: { status: 'WITHIN_BUDGET', dailyAverageAmount: 0, exhaustionDate: null },
  });
  await render(<InsightsScreen />);

  await screen.findByText('이번 주와 지난주에 기록한 지출이 없어요');
  screen.getByText('하루 평균 0원');
  expect(screen.queryByText('카테고리별 변화')).toBeNull();
});

test('last-week-only spending has a zero-length bar and no increase headline', async () => {
  mockApi.getInsights.mockResolvedValue({
    ...EXHAUST,
    weekly: { ...WEEKLY, categories: [{ category: 'FOOD', thisWeekAmount: 0, lastWeekAmount: 9000, changeAmount: -9000 }] },
  });
  await render(<InsightsScreen />);

  await screen.findByText('이번 주에는 지난주보다 늘어난 지출이 없어요');
  expect(StyleSheet.flatten(screen.getByTestId('this-week-bar-FOOD').props.style).width).toBe('0%');
});

test('an unknown status hides only the forecast card', async () => {
  mockApi.getInsights.mockResolvedValue({
    ...EXHAUST,
    forecast: { status: 'SOMETHING_NEW', dailyAverageAmount: 2392, exhaustionDate: null },
  });
  await render(<InsightsScreen />);

  await screen.findByText('카테고리별 변화');
  expect(screen.getByTestId('weekly-headline')).toBeTruthy();
  expect(screen.queryByText(/하루 평균/)).toBeNull();
  expect(screen.queryByText(/이 속도면|예산을 모두 썼어요|4일부터|예산이 없어/)).toBeNull();
});

test('a failed load shows the error and retries', async () => {
  mockApi.getInsights.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(EXHAUST);
  await render(<InsightsScreen />);

  await screen.findByText(CONNECTION_ERROR);
  fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));
  await screen.findByText('이 속도면 10월 30일에 예산을 다 써요');
  expect(mockApi.getInsights).toHaveBeenCalledTimes(2);
});

test('returning to the screen reloads', async () => {
  mockApi.getInsights.mockResolvedValue(EXHAUST);
  await render(<InsightsScreen />);
  await screen.findByText('카테고리별 변화');

  await act(async () => mockFocusEffect?.());
  expect(mockApi.getInsights).toHaveBeenCalledTimes(2);
});
