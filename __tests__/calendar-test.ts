import { calendarCells, formatDayAmount, initialSelectedDay } from '@/lib/calendar';

describe('formatDayAmount', () => {
  test.each([
    [500, '500'],
    [999, '999'],
    [1_000, '1천'],
    [8_700, '8천'],
    [9_999, '9천'],
    [10_000, '1만'],
    [12_800, '1.2만'],
    [30_000, '3만'],
    [1_250_000, '125만'],
    [99_999_999, '9999.9만'],
    [100_000_000, '1억'],
    [125_000_000, '1.2억'],
  ])('%p shows as %p, rounding down', (amount, text) => {
    expect(formatDayAmount(amount)).toBe(text);
  });
});

describe('calendarCells', () => {
  test('starts on Sunday with blanks before the 1st and ends on the last day', () => {
    // 2026-10-01 is a Thursday and 10-31 a Saturday, so the last week has no trailing blank.
    const cells = calendarCells('2026-10');
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, '2026-10-01']);
    expect(cells.filter(Boolean)).toHaveLength(31);
    expect(cells.at(-1)).toBe('2026-10-31');
    expect(cells).toHaveLength(35);
  });

  test('a month starting on Sunday has no leading blank', () => {
    // 2026-02-01 is a Sunday; 2026 is not a leap year.
    const cells = calendarCells('2026-02');
    expect(cells[0]).toBe('2026-02-01');
    expect(cells.at(-1)).toBe('2026-02-28');
    expect(cells).toHaveLength(28);
  });

  test('fills the last week with blanks after the last day', () => {
    // 2026-09-30 is a Wednesday.
    expect(calendarCells('2026-09').slice(-4)).toEqual(['2026-09-30', null, null, null]);
  });

  test('includes February 29 in a leap year', () => {
    expect(calendarCells('2028-02').filter(Boolean).at(-1)).toBe('2028-02-29');
  });
});

describe('initialSelectedDay', () => {
  // 2026-10-27 16:00 UTC is 2026-10-28 01:00 in Seoul.
  const now = new Date('2026-10-27T16:00:00Z');

  test('is today (in Seoul) for the current month', () => {
    expect(initialSelectedDay('2026-10', now)).toBe('2026-10-28');
  });

  test('is the 1st for a past month', () => {
    expect(initialSelectedDay('2026-09', now)).toBe('2026-09-01');
  });
});
