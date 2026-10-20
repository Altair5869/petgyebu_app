import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import HomeScreen from '@/app/index';

jest.mock('@react-native-seoul/kakao-login', () => ({ login: jest.fn() }));
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), signIn: jest.fn() },
}));

const mockApi = { getHome: jest.fn() };
const mockRefreshStage = jest.fn();
let mockFocusEffect: (() => void) | undefined;

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
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
  screen.getByLabelText('고양이, 안정: 편안하게 지내고 있어요');
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
  // The stage stayed 'ready', so the screen must not spin forever.
  await screen.findByRole('button', { name: '다시 시도' });
  screen.getByText('정보를 불러오지 못했어요. 다시 시도해 주세요.');
});

test('re-checks the stage when the pet is missing', async () => {
  mockApi.getHome.mockRejectedValue(new ApiError(409, 'PET_REQUIRED'));
  await render(<HomeScreen />);

  await waitFor(() => expect(mockRefreshStage).toHaveBeenCalledTimes(1));
  await screen.findByRole('button', { name: '다시 시도' });
});

test('offers a retry when the server is unreachable', async () => {
  mockApi.getHome.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

  await screen.findByText('고양이 · 안정');
  expect(mockApi.getHome).toHaveBeenCalledTimes(2);
});

describe('returning to the foreground', () => {
  function captureAppStateHandler() {
    const remove = jest.fn();
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(() => ({ remove }));
    return { spy, remove, handler: () => spy.mock.calls[0][1] as (state: string) => void };
  }

  afterEach(() => jest.restoreAllMocks());

  test('refetches home without the spinner and shows the new data', async () => {
    const { handler, remove } = captureAppStateHandler();
    mockApi.getHome.mockResolvedValueOnce(HOME).mockResolvedValueOnce({ ...HOME, month: '2026-11' });
    const view = await render(<HomeScreen />);
    await screen.findByText('고양이 · 안정');

    await act(async () => handler()('active'));

    await screen.findByText('2026년 11월');
    expect(mockApi.getHome).toHaveBeenCalledTimes(2);
    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });

  test('re-checks the stage when the refetch reports a missing budget', async () => {
    const { handler } = captureAppStateHandler();
    mockApi.getHome.mockResolvedValueOnce(HOME).mockRejectedValueOnce(new ApiError(409, 'BUDGET_REQUIRED'));
    await render(<HomeScreen />);
    await screen.findByText('고양이 · 안정');

    await act(async () => handler()('active'));

    await waitFor(() => expect(mockRefreshStage).toHaveBeenCalledTimes(1));
    expect(mockApi.getHome).toHaveBeenCalledTimes(2);
  });
});

test('links to expense entry and monthly stats', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '지출 기록하기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses/new');
  await fireEvent.press(screen.getByRole('link', { name: '월별 통계' }));
  expect(router.push).toHaveBeenCalledWith('/expenses');
});

test('refetches on focus without replacing the loaded home with a spinner', async () => {
  const next = new Promise(() => {});
  mockApi.getHome.mockResolvedValueOnce(HOME).mockReturnValueOnce(next);
  await render(<HomeScreen />);
  await screen.findByText('고양이 · 안정');

  await act(async () => mockFocusEffect?.());

  expect(mockApi.getHome).toHaveBeenCalledTimes(2);
  screen.getByText('고양이 · 안정');
});

test('shows the new totals after a focus refetch', async () => {
  mockApi.getHome.mockResolvedValueOnce(HOME).mockResolvedValueOnce({
    ...HOME,
    petState: 'CAUTION',
    spentAmount: 162000,
    usagePercent: 54,
    budgetBalanceAmount: 138000,
  });
  await render(<HomeScreen />);
  await screen.findByText('300,000원 남았어요');

  await act(async () => mockFocusEffect?.());

  await screen.findByText('고양이 · 주의');
  screen.getByText('138,000원 남았어요');
  screen.getByText('사용률 54%');
});

test('links to the settings screen', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('link', { name: '설정' }));

  expect(router.push).toHaveBeenCalledWith('/settings');
});
