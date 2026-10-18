import { CATEGORIES, CATEGORY_LABELS, expenseRowText, parseMemo } from '@/lib/expense';

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
