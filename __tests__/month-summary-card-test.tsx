import { render, screen } from '@testing-library/react-native';

import { MonthSummaryCard } from '@/components/month-summary-card';

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

test('keeps each cell value on one line, shrinking long amounts to fit', async () => {
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
    expect(value.props.numberOfLines).toBe(1);
    expect(value.props.adjustsFontSizeToFit).toBe(true);
  }
});
