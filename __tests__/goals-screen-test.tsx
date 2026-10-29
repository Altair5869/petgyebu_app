import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import type { ExpenseCategory } from '@/api/types';
import GoalsScreen from '@/app/goals';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { currentMonth, monthName, monthTitle, previousMonth } from '@/lib/month';

const MONTH = previousMonth(currentMonth());
const EXCEED = '목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요.';

let mockParams: { month?: string } = {};
const mockApi = { getCategoryGoals: jest.fn(), putCategoryGoal: jest.fn(), deleteCategoryGoal: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => mockParams,
    useFocusEffect: (effect: () => void) => {
      useEffect(() => effect(), [effect]);
    },
  };
});

function goalsOf(budgetAmount: number | null, amounts: Partial<Record<ExpenseCategory, number>> = {}) {
  const entries = Object.entries(amounts) as [ExpenseCategory, number][];
  const goalTotalAmount = entries.reduce((sum, [, amount]) => sum + amount, 0);
  return {
    month: MONTH,
    budgetAmount,
    goalTotalAmount,
    goalsExceedBudget: budgetAmount !== null && goalTotalAmount > budgetAmount,
    goals: entries.map(([category, goalAmount]) => ({
      category,
      goalAmount,
      spentAmount: 0,
      remainingAmount: goalAmount,
      usagePercent: 0,
    })),
  };
}

// Records every write in order, so tests can check the save sequence.
let calls: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { month: MONTH };
  calls = [];
  mockApi.putCategoryGoal.mockImplementation((month: string, category: string, amount: number) => {
    calls.push(`put ${category} ${amount}`);
    return Promise.resolve({ month, category, amount });
  });
  mockApi.deleteCategoryGoal.mockImplementation((_month: string, category: string) => {
    calls.push(`delete ${category}`);
    return Promise.resolve(undefined);
  });
});

const field = (label: string) => screen.getByLabelText(`${label} 목표 금액`);
const saveButton = () => screen.getByRole('button', { name: '저장' });

async function renderWith(budget: number | null, amounts: Partial<Record<ExpenseCategory, number>>) {
  mockApi.getCategoryGoals.mockResolvedValue(goalsOf(budget, amounts));
  await render(<GoalsScreen />);
  await screen.findByText(`${monthTitle(MONTH)} 카테고리 목표`);
}

test('fills the fields from the server goals and shows the totals', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });

  expect(mockApi.getCategoryGoals).toHaveBeenCalledWith(MONTH);
  expect(field('식비')).toHaveDisplayValue('150,000');
  expect(field('카페')).toHaveDisplayValue('50,000');
  for (const label of ['교통', '쇼핑', '건강', '생활', '기타']) expect(field(label)).toHaveDisplayValue('');
  expect(screen.getByText('예산 500,000원 · 목표 합 200,000원')).toBeTruthy();
  expect(screen.getByText('더 정할 수 있는 금액 300,000원')).toBeTruthy();
  expect(saveButton()).toBeDisabled();
});

test('recalculates the totals while typing and blocks saving over the budget', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });

  await fireEvent.changeText(field('쇼핑'), '100000');
  expect(field('쇼핑')).toHaveDisplayValue('100,000');
  expect(screen.getByText('더 정할 수 있는 금액 200,000원')).toBeTruthy();
  expect(saveButton()).toBeEnabled();

  await fireEvent.changeText(field('쇼핑'), '330000');
  expect(screen.getByText('예산 500,000원 · 목표 합 530,000원')).toBeTruthy();
  expect(screen.getByText('예산보다 30,000원 많아요')).toBeTruthy();
  expect(saveButton()).toBeDisabled();
});

test('keeps saving disabled when a field is retyped with the same value', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });

  await fireEvent.changeText(field('식비'), '150000');
  expect(saveButton()).toBeDisabled();
});

test('shows an error under an invalid field and disables saving', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });

  await fireEvent.changeText(field('쇼핑'), '0');
  expect(screen.getByText('1원부터 1억 원까지 입력할 수 있어요')).toBeTruthy();
  expect(saveButton()).toBeDisabled();
});

test('re-reads the goals, deletes cleared goals before adding new ones, then goes back', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });

  await fireEvent.changeText(field('카페'), '');
  await fireEvent.changeText(field('쇼핑'), '80000');
  await fireEvent.press(saveButton());

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockApi.getCategoryGoals).toHaveBeenCalledTimes(2);
  expect(calls).toEqual(['delete CAFE', 'put SHOPPING 80000']);
  expect(mockApi.deleteCategoryGoal).toHaveBeenCalledWith(MONTH, 'CAFE');
  expect(mockApi.putCategoryGoal).toHaveBeenCalledWith(MONTH, 'SHOPPING', 80000);
});

test('lowers goals that exceed the budget in a server-safe order', async () => {
  await renderWith(80000, { FOOD: 40000, CAFE: 60000 });
  expect(screen.getByText(EXCEED)).toBeTruthy();

  await fireEvent.changeText(field('식비'), '30000');
  await fireEvent.changeText(field('카페'), '50000');
  await fireEvent.press(saveButton());

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(calls).toEqual(['delete FOOD', 'put CAFE 50000', 'put FOOD 30000']);
});

test('stops at the first failed write, re-reads, and marks fields that did not save', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });
  mockApi.putCategoryGoal.mockImplementation((month: string, category: string, amount: number) => {
    calls.push(`put ${category} ${amount}`);
    return category === 'SHOPPING'
      ? Promise.reject(
          new ApiError(409, 'CATEGORY_GOALS_EXCEED_BUDGET', [], '카테고리 목표 합계가 월 예산을 넘을 수 없습니다.'),
        )
      : Promise.resolve({ month, category, amount });
  });

  await fireEvent.changeText(field('교통'), '10000');
  await fireEvent.changeText(field('쇼핑'), '20000');
  await fireEvent.changeText(field('건강'), '30000');
  // The pre-save read still sees the old goals; the read after the failure sees TRANSPORT saved.
  mockApi.getCategoryGoals
    .mockResolvedValueOnce(goalsOf(500000, { FOOD: 150000, CAFE: 50000 }))
    .mockResolvedValue(goalsOf(500000, { FOOD: 150000, CAFE: 50000, TRANSPORT: 10000 }));
  await fireEvent.press(saveButton());

  await screen.findByText('카테고리 목표 합계가 월 예산을 넘을 수 없습니다.');
  expect(calls).toEqual(['put TRANSPORT 10000', 'put SHOPPING 20000']);
  // Initial load, the pre-save read, and the read after the failure.
  await waitFor(() => expect(mockApi.getCategoryGoals).toHaveBeenCalledTimes(3));
  // SHOPPING failed and HEALTH was never sent; TRANSPORT is on the server.
  expect(await screen.findAllByText('저장되지 않았어요')).toHaveLength(2);
  expect(field('쇼핑')).toHaveDisplayValue('20,000');
  expect(router.back).not.toHaveBeenCalled();
});

test('shows a server amount error under the field that failed', async () => {
  await renderWith(500000, { FOOD: 150000 });
  mockApi.putCategoryGoal.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'amount', message: '1 이상 100000000 이하의 정수여야 합니다.' }]),
  );

  await fireEvent.changeText(field('쇼핑'), '20000');
  await fireEvent.press(saveButton());

  await screen.findByText('1 이상 100000000 이하의 정수여야 합니다.');
  expect(router.back).not.toHaveBeenCalled();
});

test('sends nothing when the budget was lowered elsewhere before saving', async () => {
  await renderWith(500000, { FOOD: 150000, CAFE: 50000 });

  await fireEvent.changeText(field('쇼핑'), '100000');
  mockApi.getCategoryGoals.mockResolvedValue(goalsOf(250000, { FOOD: 150000, CAFE: 50000 }));
  await fireEvent.press(saveButton());

  await screen.findByText(EXCEED);
  expect(screen.getByText('예산 250,000원 · 목표 합 300,000원')).toBeTruthy();
  expect(field('쇼핑')).toHaveDisplayValue('100,000');
  expect(mockApi.putCategoryGoal).not.toHaveBeenCalled();
  expect(mockApi.deleteCategoryGoal).not.toHaveBeenCalled();
  expect(router.back).not.toHaveBeenCalled();
});

test('saves once when the button is pressed twice quickly', async () => {
  await renderWith(500000, { FOOD: 150000 });
  let resolveRead: (value: unknown) => void = () => {};
  mockApi.getCategoryGoals.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
  );

  await fireEvent.changeText(field('쇼핑'), '20000');
  await fireEvent.press(saveButton());
  await fireEvent.press(saveButton());
  resolveRead(goalsOf(500000, { FOOD: 150000 }));

  await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
  expect(mockApi.getCategoryGoals).toHaveBeenCalledTimes(2);
  expect(calls).toEqual(['put SHOPPING 20000']);
});

test('asks for the month budget first when the month has none', async () => {
  mockApi.getCategoryGoals.mockResolvedValue(goalsOf(null));
  await render(<GoalsScreen />);

  await screen.findByText('목표를 정하려면 이 달 예산이 먼저 있어야 해요.');
  await fireEvent.press(screen.getByRole('button', { name: `${monthName(MONTH)} 예산 넣기` }));

  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/budget', params: { month: MONTH } });
});

test('shows a retry when loading fails', async () => {
  mockApi.getCategoryGoals.mockRejectedValueOnce(new TypeError('Network request failed'));
  mockApi.getCategoryGoals.mockResolvedValueOnce(goalsOf(500000, { FOOD: 150000 }));
  await render(<GoalsScreen />);

  await screen.findByText(CONNECTION_ERROR);
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await waitFor(() => expect(field('식비')).toHaveDisplayValue('150,000'));
});

test.each(['2099-01', 'abc', undefined])('rejects an invalid month param (%s)', async (value) => {
  mockParams = { month: value };
  await render(<GoalsScreen />);

  await screen.findByText('잘못된 접근이에요');
  await fireEvent.press(screen.getByRole('button', { name: '뒤로' }));
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(mockApi.getCategoryGoals).not.toHaveBeenCalled();
});
