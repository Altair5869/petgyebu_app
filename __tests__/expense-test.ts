import type { ExpenseUpdate, NewExpense } from '@/api/types';
import { CATEGORIES, CATEGORY_LABELS, expenseChanges, expenseRowText, parseCategoryParam, parseMemo } from '@/lib/expense';

test('lists the seven categories in the fixed code order with Korean names', () => {
  expect(CATEGORIES).toEqual(['FOOD', 'CAFE', 'TRANSPORT', 'SHOPPING', 'HEALTH', 'LIVING', 'OTHER']);
  expect(CATEGORIES.map((c) => CATEGORY_LABELS[c])).toEqual(['식비', '카페', '교통', '쇼핑', '건강', '생활', '기타']);
});

describe('parseMemo', () => {
  test('treats empty or whitespace-only memos as null', () => {
    expect(parseMemo('')).toEqual({ ok: true, memo: null });
    expect(parseMemo('  \n ')).toEqual({ ok: true, memo: null });
  });

  test('accepts up to 100 code points, counting an emoji as one', () => {
    expect(parseMemo('가'.repeat(100))).toEqual({ ok: true, memo: '가'.repeat(100) });
    expect(parseMemo('😀'.repeat(100))).toEqual({ ok: true, memo: '😀'.repeat(100) });
  });

  test('rejects 101 code points', () => {
    expect(parseMemo('가'.repeat(101))).toEqual({ ok: false, error: '메모는 100자까지 입력할 수 있어요' });
  });
});

describe('expenseRowText', () => {
  test('uses the memo as the title when present', () => {
    expect(expenseRowText({ expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' })).toEqual({
      title: '라떼',
      subtitle: '10월 17일 · 카페',
    });
  });

  test('uses the category as the title without a memo', () => {
    expect(expenseRowText({ expenseDate: '2026-10-07', category: 'OTHER', memo: null })).toEqual({
      title: '기타',
      subtitle: '10월 7일',
    });
  });
});

describe('expenseChanges', () => {
  const ORIGINAL: NewExpense = { amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' };
  test.each([
    ['nothing', {}, {}],
    ['amount', { amount: 7000 }, { amount: 7000 }],
    ['date', { expenseDate: '2026-10-03' }, { expenseDate: '2026-10-03' }],
    ['category', { category: 'FOOD' }, { category: 'FOOD' }],
    ['memo text', { memo: '아이스 라떼' }, { memo: '아이스 라떼' }],
    ['memo cleared', { memo: null }, { memo: null }],
    ['trailing space is a change', { memo: '라떼 ' }, { memo: '라떼 ' }],
  ] as [string, Partial<NewExpense>, ExpenseUpdate][])('%s', (_, edit, expected) => {
    expect(expenseChanges(ORIGINAL, { ...ORIGINAL, ...edit })).toEqual(expected);
  });

  test('no memo before and after is no change', () => {
    const noMemo = { ...ORIGINAL, memo: null };
    expect(expenseChanges(noMemo, noMemo)).toEqual({});
  });
});

describe('parseCategoryParam', () => {
  test('accepts only the exact category codes', () => {
    expect(parseCategoryParam('CAFE')).toBe('CAFE');
    expect(parseCategoryParam('cafe')).toBeNull();
    expect(parseCategoryParam('X')).toBeNull();
    expect(parseCategoryParam(undefined)).toBeNull();
  });
});
