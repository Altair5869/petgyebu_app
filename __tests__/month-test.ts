import {
  canGoToNextMonth,
  canGoToPreviousMonth,
  currentMonth,
  dateToSeoulDay,
  formatDay,
  monthName,
  monthTitle,
  nextMonth,
  parseMonthParam,
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

describe('nextMonth', () => {
  test('goes forward one month', () => {
    expect(nextMonth('2026-09')).toBe('2026-10');
  });

  test('wraps December to January of the next year', () => {
    expect(nextMonth('2026-12')).toBe('2027-01');
  });
});

describe('previousMonth boundary', () => {
  test('wraps January to the previous December', () => {
    expect(previousMonth('2027-01')).toBe('2026-12');
  });
});

describe('canGoToPreviousMonth', () => {
  test('stops at 2000-01', () => {
    expect(canGoToPreviousMonth('2000-01')).toBe(false);
    expect(canGoToPreviousMonth('2000-02')).toBe(true);
  });
});

describe('canGoToNextMonth', () => {
  test('never moves past the current Seoul month', () => {
    const now = new Date('2026-10-19T00:00:00Z');
    expect(canGoToNextMonth('2026-10', now)).toBe(false);
    expect(canGoToNextMonth('2026-09', now)).toBe(true);
  });

  test('uses the Seoul month, so late October UTC is already November', () => {
    // 2026-10-31 15:00 UTC is 2026-11-01 00:00 in Seoul
    expect(canGoToNextMonth('2026-10', new Date('2026-10-31T15:00:00Z'))).toBe(true);
  });
});

test('monthName gives the month number with 월', () => {
  expect(monthName('2026-09')).toBe('9월');
  expect(monthName('2026-10')).toBe('10월');
});

describe('parseMonthParam', () => {
  test('accepts a well-formed month up to the current one', () => {
    expect(parseMonthParam('2026-09', new Date('2026-10-15T00:00:00+09:00'))).toBe('2026-09');
    expect(parseMonthParam(currentMonth())).toBe(currentMonth());
  });

  test('rejects malformed, out-of-range or missing values', () => {
    expect(parseMonthParam('2026-9')).toBeNull();
    expect(parseMonthParam('1999-12')).toBeNull();
    expect(parseMonthParam('2099-01')).toBeNull();
    expect(parseMonthParam(nextMonth(currentMonth()))).toBeNull();
    expect(parseMonthParam(undefined)).toBeNull();
  });
});
