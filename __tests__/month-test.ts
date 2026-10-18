import { currentMonth, monthTitle, previousMonth } from '@/lib/month';

describe('currentMonth', () => {
  test('uses Seoul time, not the device time zone', () => {
    // 2026-10-31 15:30 UTC is 2026-11-01 00:30 in Seoul
    expect(currentMonth(new Date('2026-10-31T15:30:00Z'))).toBe('2026-11');
  });

  test('stays in the month until Seoul midnight', () => {
    // 2026-10-31 14:59:59 UTC is 2026-10-31 23:59:59 in Seoul
    expect(currentMonth(new Date('2026-10-31T14:59:59Z'))).toBe('2026-10');
  });
});

describe('previousMonth', () => {
  test('goes back one month', () => {
    expect(previousMonth('2026-10')).toBe('2026-09');
  });

  test('wraps January to December of the previous year', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('monthTitle', () => {
  test('formats YYYY-MM as a Korean title', () => {
    expect(monthTitle('2026-03')).toBe('2026년 3월');
  });
});
