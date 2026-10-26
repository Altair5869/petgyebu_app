import type { Expense, ExpenseCategory, ExpenseUpdate, NewExpense } from '@/api/types';

import { formatDay } from './month';

export const CATEGORIES: ExpenseCategory[] = ['FOOD', 'CAFE', 'TRANSPORT', 'SHOPPING', 'HEALTH', 'LIVING', 'OTHER'];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: '식비',
  CAFE: '카페',
  TRANSPORT: '교통',
  SHOPPING: '쇼핑',
  HEALTH: '건강',
  LIVING: '생활',
  OTHER: '기타',
};

const MEMO_MAX = 100;

export type MemoInput = { ok: true; memo: string | null } | { ok: false; error: string };

export function parseMemo(text: string): MemoInput {
  if (text.trim() === '') return { ok: true, memo: null };
  // The server counts Unicode code points, so an emoji is one character.
  if ([...text].length > MEMO_MAX) return { ok: false, error: '메모는 100자까지 입력할 수 있어요' };
  return { ok: true, memo: text };
}

export function expenseRowText(expense: Pick<Expense, 'expenseDate' | 'category' | 'memo'>) {
  const day = formatDay(expense.expenseDate);
  const label = CATEGORY_LABELS[expense.category];
  return expense.memo ? { title: expense.memo, subtitle: `${day} · ${label}` } : { title: label, subtitle: day };
}

// `edited.memo` must already be normalized by parseMemo.
export function expenseChanges(original: NewExpense, edited: NewExpense): ExpenseUpdate {
  const changes: ExpenseUpdate = {};
  if (edited.amount !== original.amount) changes.amount = edited.amount;
  if (edited.expenseDate !== original.expenseDate) changes.expenseDate = edited.expenseDate;
  if (edited.category !== original.category) changes.category = edited.category;
  if (edited.memo !== original.memo) changes.memo = edited.memo;
  return changes;
}
