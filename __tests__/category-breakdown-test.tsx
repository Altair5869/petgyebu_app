import { render, screen } from '@testing-library/react-native';

import { CategoryBreakdown } from '@/components/category-breakdown';

test('shows legend rows in response order and flex-sized bar pieces', async () => {
  await render(
    <CategoryBreakdown
      categories={[
        { category: 'CAFE', spentAmount: 16000, expenseCount: 2, sharePercent: 61.5 },
        { category: 'FOOD', spentAmount: 8000, expenseCount: 1, sharePercent: 30.8 },
      ]}
    />,
  );
  expect(screen.getByText('카테고리')).toBeOnTheScreen();
  expect(screen.getByText('카페')).toBeOnTheScreen();
  expect(screen.getByText('16,000원 · 61.5%')).toBeOnTheScreen();
  expect(screen.getByText('식비')).toBeOnTheScreen();
  expect(screen.getByText('8,000원 · 30.8%')).toBeOnTheScreen();
  expect(screen.getByTestId('category-bar-CAFE')).toHaveStyle({ flex: 61.5 });
});

test('empty list shows only the empty message', async () => {
  await render(<CategoryBreakdown categories={[]} />);
  expect(screen.getByText('이 달에는 기록한 지출이 없어요')).toBeOnTheScreen();
  expect(screen.queryByText('카테고리')).toBeNull();
});
