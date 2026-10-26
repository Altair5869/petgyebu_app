import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import { AppState, StyleSheet } from 'react-native';

import { ApiError } from '@/api/client';
import HomeScreen from '@/app/index';

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

test('DOG home offers a head-petting control while preserving budget information', async () => {
  mockApi.getHome.mockResolvedValue({ ...HOME, petType: 'DOG' });
  await render(<HomeScreen />);
  await screen.findByLabelText('강아지, 안정');
  screen.getByRole('button', { name: '강아지 쓰다듬기' });
  screen.getByLabelText('300,000원 남았어요');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshStage.mockResolvedValue(undefined);
});

test('shows pet state, balance, usage, and the first-record guide', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  // Only the state name is shown; the pet type is read from the label. getBy* throws on duplicates,
  // so the hidden pet picture must not repeat the state.
  expect(await screen.findByLabelText('고양이, 안정')).toHaveTextContent('안정', { exact: true });
  screen.getByText('예산에 여유가 있어 마음이 편안해요');
  screen.getByLabelText('300,000원 남았어요');
  expect(screen.getAllByText('300,000원')).toHaveLength(2);
  screen.getByText('남은 예산', { exact: true });
  screen.getByText('사용률 0%');
  screen.getByText('이번 달 지출');
  screen.getByText('0원');
  screen.getByText('이번 달 예산');
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

  await screen.findByLabelText('10,000원 초과했어요');
  screen.getByText('사용률 103.3%');
  expect(screen.queryByTestId('budget-gauge-fill', { includeHiddenElements: true })).toBeNull();
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

  await screen.findByLabelText('고양이, 안정');
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
    await screen.findByLabelText('고양이, 안정');

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
    await screen.findByLabelText('고양이, 안정');

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
  await screen.findByLabelText('고양이, 안정');

  await act(async () => mockFocusEffect?.());

  expect(mockApi.getHome).toHaveBeenCalledTimes(2);
  screen.getByLabelText('고양이, 안정');
});

function gaugeWidth() {
  const fill = screen.getByTestId('budget-gauge-fill', { includeHiddenElements: true });
  return StyleSheet.flatten(fill.props.style).width;
}

test('shows the new totals after a focus refetch', async () => {
  mockApi.getHome.mockResolvedValueOnce(HOME).mockResolvedValueOnce({
    ...HOME,
    petState: 'CAUTION',
    spentAmount: 162000,
    usagePercent: 54,
    budgetBalanceAmount: 138000,
  });
  await render(<HomeScreen />);
  await screen.findByLabelText('300,000원 남았어요');
  expect(gaugeWidth()).toBe('100%');

  await act(async () => mockFocusEffect?.());

  await screen.findByLabelText('고양이, 주의');
  screen.getByLabelText('138,000원 남았어요');
  screen.getByText('사용률 54%');
  expect(gaugeWidth()).toBe('46%');
});

test('links to the settings screen', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('link', { name: '설정' }));

  expect(router.push).toHaveBeenCalledWith('/settings');
});


test.each([
  [49.9, 'STABLE', '안정', 49999, 50001],
  [50, 'CAUTION', '주의', 50000, 50000],
  [80, 'WARNING', '경고', 80000, 20000],
  [100, 'BUDGET_REACHED', '예산 도달', 100000, 0],
])('preserves API state and percentage at %s%%', async (usagePercent, petState, name, spentAmount, budgetBalanceAmount) => {
  mockApi.getHome.mockResolvedValue({ ...HOME, budgetAmount: 100000, usagePercent, petState, spentAmount, budgetBalanceAmount });
  await render(<HomeScreen />);
  await screen.findByLabelText(`고양이, ${name}`);
  screen.getByText(`사용률 ${usagePercent}%`);
  if (budgetBalanceAmount === 0) {
    screen.getByLabelText('예산을 모두 사용했어요, 남은 예산 0원');
    screen.getByText('0원');
    expect(screen.queryByText('초과 금액')).toBeNull();
    expect(screen.queryByTestId('budget-gauge-fill', { includeHiddenElements: true })).toBeNull();
  }
});

test('shows large over-budget totals in full, using the absolute balance', async () => {
  mockApi.getHome.mockResolvedValue({ ...HOME, petState: 'BUDGET_REACHED', budgetAmount: 100000000, spentAmount: 987654321, usagePercent: 987.6, budgetBalanceAmount: -887654321 });
  await render(<HomeScreen />);
  await screen.findByText('887,654,321원');
  screen.getByLabelText('887,654,321원 초과했어요');
  screen.getByText('초과 금액');
  screen.getByText('987,654,321원');
  screen.getByText('사용률 987.6%');
});


test.each([
  ['STABLE', '예산에 여유가 있어 마음이 편안해요'],
  ['CAUTION', '남은 예산을 함께 살펴볼까요?'],
  ['WARNING', '예산이 얼마 남지 않아 조금 걱정돼요'],
  ['BUDGET_REACHED', '앗, 이번 달 예산을 모두 사용했어요'],
])('uses the approved supportive copy for %s', async (petState, description) => {
  mockApi.getHome.mockResolvedValue({ ...HOME, petState });
  await render(<HomeScreen />);
  await screen.findByText(description);
});
