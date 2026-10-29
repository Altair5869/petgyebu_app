import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CategoryGoals } from '@/api/types';
import { CategoryGoalsCard } from '@/components/category-goals-card';
import { monthName } from '@/lib/month';
import { colors } from '@/theme';

const MONTH = '2026-09';
const NAME = monthName(MONTH);

const base: CategoryGoals = { month: MONTH, budgetAmount: 500000, goalTotalAmount: 0, goalsExceedBudget: false, goals: [] };
const withGoals: CategoryGoals = {
  ...base,
  goalTotalAmount: 250000,
  goals: [
    { category: 'FOOD', goalAmount: 150000, spentAmount: 120000, remainingAmount: 30000, usagePercent: 80 },
    { category: 'CAFE', goalAmount: 100000, spentAmount: 112000, remainingAmount: -12000, usagePercent: 112 },
  ],
};

async function setup(goals: CategoryGoals) {
  const handlers = { onEditGoals: jest.fn(), onAddBudget: jest.fn(), onSelect: jest.fn() };
  await render(<CategoryGoalsCard goals={goals} {...handlers} />);
  return { handlers };
}

test('no budget shows the sentence and the add-budget button', async () => {
  const { handlers } = await setup({ ...base, budgetAmount: null });
  screen.getByText('목표를 정하려면 이 달 예산이 먼저 있어야 해요.');
  await fireEvent.press(screen.getByRole('button', { name: `${NAME} 예산 넣기` }));
  expect(handlers.onAddBudget).toHaveBeenCalled();
});

test('budget without goals shows the empty sentence and the set-goals button', async () => {
  const { handlers } = await setup(base);
  screen.getByText('이 달에 정한 목표가 없어요.');
  await fireEvent.press(screen.getByRole('button', { name: '목표 정하기' }));
  expect(handlers.onEditGoals).toHaveBeenCalled();
});

test('goal rows show remaining or over, progress text and a capped bar', async () => {
  const { handlers } = await setup(withGoals);
  screen.getByText('카테고리 목표');
  expect(screen.getByText('30,000원 남음')).not.toHaveStyle({ color: colors.danger });
  expect(screen.getByText('12,000원 초과')).toHaveStyle({ color: colors.danger });
  screen.getByText('120,000원 / 목표 150,000원');
  expect(screen.getByTestId('goal-bar-CAFE')).toHaveStyle({ width: '100%' });
  expect(screen.getByTestId('goal-bar-FOOD')).toHaveStyle({ width: '80%' });
  await fireEvent.press(screen.getByRole('button', { name: '고치기 ›' }));
  expect(handlers.onEditGoals).toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole('button', { name: '식비, 목표 150,000원 중 120,000원 썼어요, 30,000원 남았어요' }),
  );
  expect(handlers.onSelect).toHaveBeenCalledWith('FOOD');
});

test('goals exceeding the budget show the warning', async () => {
  await setup({ ...withGoals, goalsExceedBudget: true });
  screen.getByText('목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요.');
});

test('no warning when goals fit the budget', async () => {
  await setup(withGoals);
  expect(screen.queryByText('목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요.')).toBeNull();
});
