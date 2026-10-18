import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import HomeScreen from '@/app/index';

const mockApi = { getHome: jest.fn() };
const mockRefreshStage = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
}));

const HOME = {
  month: '2026-10',
  petType: 'CAT',
  petState: 'STABLE',
  budgetAmount: 300000,
  spentAmount: 0,
  usagePercent: 0,
  budgetBalanceAmount: 300000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshStage.mockResolvedValue(undefined);
});

test('shows pet state, balance, usage, and the first-record guide', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  await screen.findByText('고양이 · 안정');
  screen.getByText('300,000원 남았어요');
  screen.getByText('사용률 0%');
  screen.getByText('300,000원 중 0원 사용');
  screen.getByText('첫 지출을 기록해 보세요');
});

test('shows the over-budget amount', async () => {
  mockApi.getHome.mockResolvedValue({
    ...HOME,
    petState: 'BUDGET_REACHED',
    spentAmount: 310000,
    usagePercent: 103.3,
    budgetBalanceAmount: -10000,
  });
  await render(<HomeScreen />);

  await screen.findByText('10,000원 초과했어요');
  screen.getByText('사용률 103.3%');
  expect(screen.queryByText('첫 지출을 기록해 보세요')).toBeNull();
});

test('re-checks the stage when the budget is missing', async () => {
  mockApi.getHome.mockRejectedValue(new ApiError(409, 'BUDGET_REQUIRED'));
  await render(<HomeScreen />);

  await waitFor(() => expect(mockRefreshStage).toHaveBeenCalledTimes(1));
});

test('offers a retry when the server is unreachable', async () => {
  mockApi.getHome.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

  await screen.findByText('고양이 · 안정');
  expect(mockApi.getHome).toHaveBeenCalledTimes(2);
});
