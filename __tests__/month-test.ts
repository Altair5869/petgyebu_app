import {
  currentMonth,
  dateToSeoulDay,
  formatDay,
  monthTitle,
  previousMonth,
  seoulDayToDate,
  todayInSeoul,
} from '@/lib/month';

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

describe('todayInSeoul', () => {
  test('switches the day at Seoul midnight', () => {
    expect(todayInSeoul(new Date('2026-10-17T14:59:59Z'))).toBe('2026-10-17');
    expect(todayInSeoul(new Date('2026-10-17T15:00:00Z'))).toBe('2026-10-18');
  });
});

describe('seoulDayToDate / dateToSeoulDay', () => {
  test('round-trips a Seoul calendar day', () => {
    expect(dateToSeoulDay(seoulDayToDate('2000-01-01'))).toBe('2000-01-01');
    expect(dateToSeoulDay(seoulDayToDate('2026-12-31'))).toBe('2026-12-31');
  });
});

describe('formatDay', () => {
  test('formats a day without leading zeros', () => {
    expect(formatDay('2026-10-07')).toBe('10월 7일');
  });
});
