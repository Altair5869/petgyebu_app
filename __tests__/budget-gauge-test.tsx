import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { BudgetGauge } from '@/components/budget-gauge';
import { remainingBudgetRatio } from '@/lib/pet';

const SEEN = { includeHiddenElements: true };

test.each([
  [300000, 300000, 1],
  [300000, 200000, 2 / 3],
  [100000, 1, 0.00001],
  [100000, 0, 0],
  [100000, -10000, 0],
  [0, 0, 0],
])('budget %d with balance %d leaves %f of the gauge', (budget, balance, ratio) => {
  expect(remainingBudgetRatio(budget, balance)).toBeCloseTo(ratio, 6);
});

function fillStyle() {
  return StyleSheet.flatten(screen.getByTestId('budget-gauge-fill', SEEN).props.style);
}

test('fills the gauge with the share of budget left, in the state color', async () => {
  await render(<BudgetGauge petState="CAUTION" budgetAmount={150000} budgetBalanceAmount={50000} />);

  expect(fillStyle()).toMatchObject({ width: `${(50000 / 150000) * 100}%`, backgroundColor: '#FED16C' });
  screen.getByText('남은 예산', SEEN);
});

test('uses the warning color while little budget is left', async () => {
  await render(<BudgetGauge petState="WARNING" budgetAmount={110000} budgetBalanceAmount={10000} />);

  expect(fillStyle().backgroundColor).toBe('#FD9457');
});

test('shows an empty gauge once the budget is used up or exceeded', async () => {
  await render(<BudgetGauge petState="BUDGET_REACHED" budgetAmount={100000} budgetBalanceAmount={-10000} />);

  expect(screen.queryByTestId('budget-gauge-fill', SEEN)).toBeNull();
});

test('is hidden from screen readers because the balance card says the same', async () => {
  await render(<BudgetGauge petState="STABLE" budgetAmount={300000} budgetBalanceAmount={300000} />);

  expect(screen.queryByText('남은 예산')).toBeNull();
  expect(isHiddenFromAccessibility(screen.getByText('남은 예산', SEEN))).toBe(true);
});
