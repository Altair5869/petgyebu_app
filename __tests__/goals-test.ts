import type { CategoryGoal, ExpenseCategory } from '@/api/types';
import { CATEGORIES } from '@/lib/expense';
import {
  goalAmountsOf,
  goalBarPercent,
  goalInputTotal,
  goalProgressText,
  goalRemaining,
  goalRowLabel,
  goalSummaryText,
  parseGoalInput,
  planGoalSaves,
  type GoalAmounts,
  type GoalOp,
} from '@/lib/goals';

const food: CategoryGoal = { category: 'FOOD', goalAmount: 150000, spentAmount: 120000, remainingAmount: 30000, usagePercent: 80 };
const cafe: CategoryGoal = { category: 'CAFE', goalAmount: 50000, spentAmount: 62000, remainingAmount: -12000, usagePercent: 124 };

describe('goal copy', () => {
  test('goalRemaining words the remainder or the overage', () => {
    expect(goalRemaining(30000)).toEqual({ text: '30,000원 남음', over: false });
    expect(goalRemaining(0)).toEqual({ text: '0원 남음', over: false });
    expect(goalRemaining(-12000)).toEqual({ text: '12,000원 초과', over: true });
  });

  test('goalBarPercent caps the bar at 100', () => {
    expect(goalBarPercent(80)).toBe(80);
    expect(goalBarPercent(116.6)).toBe(100);
    expect(goalBarPercent(0)).toBe(0);
  });

  test('goalProgressText shows spent over goal', () => {
    expect(goalProgressText(food)).toBe('120,000원 / 목표 150,000원');
  });

  test('goalRowLabel reads out the whole row', () => {
    expect(goalRowLabel(food)).toBe('식비, 목표 150,000원 중 120,000원 썼어요, 30,000원 남았어요');
    expect(goalRowLabel(cafe)).toBe('카페, 목표 50,000원 중 62,000원 썼어요, 12,000원 넘었어요');
  });

  test('goalSummaryText shows the goal and the remainder or overage', () => {
    expect(goalSummaryText(cafe)).toBe('목표 50,000원 · 12,000원 초과');
    expect(goalSummaryText(food)).toBe('목표 150,000원 · 30,000원 남음');
  });

  test('goalAmountsOf maps categories to goal amounts', () => {
    expect(goalAmountsOf([food, cafe])).toEqual({ FOOD: 150000, CAFE: 50000 });
    expect(goalAmountsOf([])).toEqual({});
  });
});

describe('goal input', () => {
  test('parseGoalInput treats empty as no goal and validates the range', () => {
    expect(parseGoalInput('')).toEqual({ ok: true, amount: null });
    expect(parseGoalInput('150,000')).toEqual({ ok: true, amount: 150000 });
    expect(parseGoalInput('0')).toEqual({ ok: false, error: '1원부터 1억 원까지 입력할 수 있어요' });
  });

  test('goalInputTotal sums valid fields and counts empty or invalid ones as 0', () => {
    const texts = Object.fromEntries(CATEGORIES.map((c) => [c, ''])) as Record<ExpenseCategory, string>;
    expect(goalInputTotal({ ...texts, FOOD: '150,000', CAFE: '50,000', SHOPPING: '0' })).toBe(200000);
  });
});

function assertWithinBudget(current: GoalAmounts, ops: GoalOp[], budget: number, desired: GoalAmounts) {
  const state: GoalAmounts = { ...current };
  const sum = () => Object.values(state).reduce((a, b) => a + b, 0);
  for (const op of ops) {
    if (op.kind === 'delete') delete state[op.category];
    else {
      state[op.category] = op.amount;
      expect(sum()).toBeLessThanOrEqual(budget);
    }
  }
  expect(state).toEqual(desired);
}

describe('planGoalSaves', () => {
  function plan(current: GoalAmounts, desired: GoalAmounts, budget: number) {
    const ops = planGoalSaves(current, desired, budget);
    assertWithinBudget(current, ops, budget, desired);
    return ops;
  }

  test('does nothing when nothing changed', () => {
    expect(plan({}, {}, 100)).toEqual([]);
    expect(plan({ FOOD: 5 }, { FOOD: 5 }, 100)).toEqual([]);
  });

  test('adds new goals', () => {
    expect(plan({}, { FOOD: 100000, CAFE: 50000 }, 500000)).toEqual([
      { kind: 'put', category: 'FOOD', amount: 100000 },
      { kind: 'put', category: 'CAFE', amount: 50000 },
    ]);
  });

  test('deletes cleared goals', () => {
    expect(plan({ FOOD: 1, CAFE: 2 }, { CAFE: 2 }, 10)).toEqual([{ kind: 'delete', category: 'FOOD' }]);
  });

  test('lowers a goal in place when there is room', () => {
    expect(plan({ FOOD: 40000, CAFE: 60000 }, { FOOD: 30000, CAFE: 60000 }, 100000)).toEqual([
      { kind: 'put', category: 'FOOD', amount: 30000 },
    ]);
  });

  test('over budget lowering deletes first and re-adds later', () => {
    expect(plan({ FOOD: 40000, CAFE: 60000 }, { FOOD: 30000, CAFE: 50000 }, 80000)).toEqual([
      { kind: 'delete', category: 'FOOD' },
      { kind: 'put', category: 'CAFE', amount: 50000 },
      { kind: 'put', category: 'FOOD', amount: 30000 },
    ]);
  });

  test('lowers before raising', () => {
    expect(plan({ FOOD: 50000, CAFE: 50000 }, { FOOD: 80000, CAFE: 20000 }, 100000)).toEqual([
      { kind: 'put', category: 'CAFE', amount: 20000 },
      { kind: 'put', category: 'FOOD', amount: 80000 },
    ]);
  });

  test('deletes come before lowers and raises', () => {
    expect(plan({ FOOD: 50000, CAFE: 50000 }, { CAFE: 30000, SHOPPING: 70000 }, 100000)).toEqual([
      { kind: 'delete', category: 'FOOD' },
      { kind: 'put', category: 'CAFE', amount: 30000 },
      { kind: 'put', category: 'SHOPPING', amount: 70000 },
    ]);
  });
});
