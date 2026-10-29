import type { CategoryGoal, ExpenseCategory } from '@/api/types';

import { CATEGORIES, CATEGORY_LABELS } from './expense';
import { formatWon, parseAmountInput } from './money';

export type GoalAmounts = Partial<Record<ExpenseCategory, number>>;

export type GoalOp =
  | { kind: 'put'; category: ExpenseCategory; amount: number }
  | { kind: 'delete'; category: ExpenseCategory };

export type GoalInput = { ok: true; amount: number | null } | { ok: false; error: string };

export function goalRemaining(remainingAmount: number): { text: string; over: boolean } {
  return remainingAmount < 0
    ? { text: `${formatWon(-remainingAmount)} 초과`, over: true }
    : { text: `${formatWon(remainingAmount)} 남음`, over: false };
}

export function goalBarPercent(usagePercent: number): number {
  return Math.min(usagePercent, 100);
}

export function goalProgressText(goal: CategoryGoal): string {
  return `${formatWon(goal.spentAmount)} / 목표 ${formatWon(goal.goalAmount)}`;
}

export function goalRowLabel(goal: CategoryGoal): string {
  const rest =
    goal.remainingAmount < 0
      ? `${formatWon(-goal.remainingAmount)} 넘었어요`
      : `${formatWon(goal.remainingAmount)} 남았어요`;
  return `${CATEGORY_LABELS[goal.category]}, 목표 ${formatWon(goal.goalAmount)} 중 ${formatWon(goal.spentAmount)} 썼어요, ${rest}`;
}

export function goalSummaryText(goal: CategoryGoal): string {
  return `목표 ${formatWon(goal.goalAmount)} · ${goalRemaining(goal.remainingAmount).text}`;
}

export function goalAmountsOf(goals: CategoryGoal[]): GoalAmounts {
  const amounts: GoalAmounts = {};
  for (const goal of goals) amounts[goal.category] = goal.goalAmount;
  return amounts;
}

// An empty field means "no goal for this category".
export function parseGoalInput(text: string): GoalInput {
  if (text.trim() === '') return { ok: true, amount: null };
  const parsed = parseAmountInput(text, '');
  return parsed.ok ? { ok: true, amount: parsed.amount } : parsed;
}

export function goalInputTotal(texts: Record<ExpenseCategory, string>): number {
  let total = 0;
  for (const category of CATEGORIES) {
    const parsed = parseGoalInput(texts[category]);
    if (parsed.ok && parsed.amount !== null) total += parsed.amount;
  }
  return total;
}

// Orders saves so the server's "sum of goals <= budget" rule holds after every step:
// deletes first, then lowers (a lower that would still exceed the budget becomes
// delete + a later re-add), then new and raised goals.
export function planGoalSaves(current: GoalAmounts, desired: GoalAmounts, budget: number): GoalOp[] {
  let sum = CATEGORIES.reduce((total, c) => total + (current[c] ?? 0), 0);
  const ops: GoalOp[] = [];
  const deferred: ExpenseCategory[] = [];

  for (const category of CATEGORIES) {
    const before = current[category];
    if (before !== undefined && desired[category] === undefined) {
      ops.push({ kind: 'delete', category });
      sum -= before;
    }
  }
  for (const category of CATEGORIES) {
    const before = current[category];
    const after = desired[category];
    if (before === undefined || after === undefined || after >= before) continue;
    if (sum - before + after <= budget) {
      ops.push({ kind: 'put', category, amount: after });
      sum += after - before;
    } else {
      ops.push({ kind: 'delete', category });
      sum -= before;
      deferred.push(category);
    }
  }
  for (const category of deferred) {
    ops.push({ kind: 'put', category, amount: desired[category] as number });
  }
  for (const category of CATEGORIES) {
    const before = current[category];
    const after = desired[category];
    if (after !== undefined && (before === undefined || after > before)) {
      ops.push({ kind: 'put', category, amount: after });
    }
  }
  return ops;
}
