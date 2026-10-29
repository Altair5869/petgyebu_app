import { fireEvent, render, screen } from '@testing-library/react-native';

import { MonthSummaryCard } from '@/components/month-summary-card';
import { monthName } from '@/lib/month';

test('shows total and the three cells', async () => {
  await render(
    <MonthSummaryCard
      stats={{
        month: '2026-10',
        budgetAmount: 300000,
        spentAmount: 26000,
        expenseCount: 4,
        usagePercent: 8.6,
        budgetBalanceAmount: 274000,
        categories: [],
      }}
    />,
  );
  for (const text of ['총 지출', '26,000원', '건수', '4건', '사용률', '8.6%', '남은 예산', '274,000원']) {
    expect(screen.getByText(text)).toBeOnTheScreen();
  }
});

test('shows long cell values in full at their own size, wrapping instead of shrinking', async () => {
  await render(
    <MonthSummaryCard
      stats={{
        month: '2026-10',
        budgetAmount: 300000,
        spentAmount: 12345678,
        expenseCount: 4,
        usagePercent: 4115.2,
        budgetBalanceAmount: -12045678,
        categories: [],
      }}
    />,
  );
  for (const text of ['4건', '4115.2%', '12,045,678원']) {
    const value = screen.getByText(text);
    expect(value.props.numberOfLines).toBeUndefined();
    expect(value.props.adjustsFontSizeToFit).toBeFalsy();
  }
});

const budgetStats = (budgetAmount: number | null) => ({
  month: '2026-09',
  budgetAmount,
  spentAmount: 26000,
  expenseCount: 4,
  usagePercent: 8.6,
  budgetBalanceAmount: 274000,
  categories: [],
});

test('budget row shows the amount and edit link, and opens the editor', async () => {
  const onEditBudget = jest.fn();
  await render(<MonthSummaryCard stats={budgetStats(300000)} onEditBudget={onEditBudget} />);
  screen.getByText(`${monthName('2026-09')} 예산`);
  screen.getByText('고치기 ›');
  await fireEvent.press(screen.getByRole('button', { name: `${monthName('2026-09')} 예산 300,000원, 고치기` }));
  expect(onEditBudget).toHaveBeenCalled();
});

test('budget row shows unset with the add link', async () => {
  const onEditBudget = jest.fn();
  await render(<MonthSummaryCard stats={budgetStats(null)} onEditBudget={onEditBudget} />);
  screen.getByText('미설정');
  screen.getByText('넣기 ›');
  await fireEvent.press(screen.getByRole('button', { name: `${monthName('2026-09')} 예산 미설정, 넣기` }));
  expect(onEditBudget).toHaveBeenCalled();
});

test('no budget row without onEditBudget', async () => {
  await render(<MonthSummaryCard stats={budgetStats(300000)} />);
  expect(screen.queryByText('고치기 ›')).toBeNull();
});
