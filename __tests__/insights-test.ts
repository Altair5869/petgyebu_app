import type { ForecastStatus, WeeklyCategoryChange } from '@/api/types';
import {
  barPercent,
  changeRowLabel,
  changeTone,
  forecastCopy,
  formatChange,
  formatDayRange,
  formatWeekRanges,
  maxWeeklyAmount,
  weeklyHeadline,
} from '@/lib/insights';

const cafe: WeeklyCategoryChange = { category: 'CAFE', thisWeekAmount: 21000, lastWeekAmount: 8000, changeAmount: 13000 };
const food: WeeklyCategoryChange = { category: 'FOOD', thisWeekAmount: 12000, lastWeekAmount: 16000, changeAmount: -4000 };
const transport: WeeklyCategoryChange = { category: 'TRANSPORT', thisWeekAmount: 5000, lastWeekAmount: 5000, changeAmount: 0 };
const rows = [cafe, food, transport];

describe('forecastCopy', () => {
  it('shows the exhaustion date and daily average', () => {
    expect(forecastCopy({ status: 'WILL_EXHAUST', dailyAverageAmount: 2392, exhaustionDate: '2026-10-30' })).toEqual({
      title: '이 속도면 10월 30일에 예산을 다 써요',
      detail: '하루 평균 2,392원',
    });
    expect(forecastCopy({ status: 'WILL_EXHAUST', dailyAverageAmount: 10000, exhaustionDate: '2026-11-05' })?.title).toBe(
      '이 속도면 11월 5일에 예산을 다 써요',
    );
  });

  it('covers the other statuses', () => {
    expect(forecastCopy({ status: 'WITHIN_BUDGET', dailyAverageAmount: 0, exhaustionDate: null })).toEqual({
      title: '이 속도면 이번 달 예산 안에서 지낼 수 있어요',
      detail: '하루 평균 0원',
    });
    expect(forecastCopy({ status: 'BUDGET_REACHED', dailyAverageAmount: null, exhaustionDate: null })).toEqual({
      title: '이번 달 예산을 모두 썼어요',
      detail: null,
    });
    expect(forecastCopy({ status: 'TOO_EARLY', dailyAverageAmount: null, exhaustionDate: null })).toEqual({
      title: '4일부터 이번 달 예측을 보여 드려요',
      detail: null,
    });
    expect(forecastCopy({ status: 'NO_BUDGET', dailyAverageAmount: null, exhaustionDate: null })).toEqual({
      title: '이번 달 예산이 없어 예측할 수 없어요',
      detail: null,
    });
  });

  it('never prints null values', () => {
    expect(forecastCopy({ status: 'WILL_EXHAUST', dailyAverageAmount: 2392, exhaustionDate: null })).toBeNull();
    expect(forecastCopy({ status: 'WITHIN_BUDGET', dailyAverageAmount: null, exhaustionDate: null })?.detail).toBeNull();
  });

  it('hides the card for an unknown status', () => {
    expect(
      forecastCopy({ status: 'SOMETHING_NEW' as ForecastStatus, dailyAverageAmount: 1, exhaustionDate: null }),
    ).toBeNull();
  });
});

describe('weeklyHeadline', () => {
  it('reports the top increase', () => {
    expect(weeklyHeadline(rows)).toEqual({ kind: 'increased', categoryLabel: '카페', amountText: '13,000원' });
  });

  it('reports no increase when the first row did not grow', () => {
    expect(weeklyHeadline([{ ...cafe, changeAmount: 0 }])).toEqual({ kind: 'noIncrease' });
    expect(
      weeklyHeadline([{ category: 'FOOD', thisWeekAmount: 0, lastWeekAmount: 9000, changeAmount: -9000 }]),
    ).toEqual({ kind: 'noIncrease' });
  });

  it('reports empty without rows', () => {
    expect(weeklyHeadline([])).toEqual({ kind: 'empty' });
  });
});

describe('week ranges', () => {
  it('formats ranges within a month, across months and years, and single days', () => {
    expect(formatDayRange({ from: '2026-10-26', to: '2026-10-28' })).toBe('10월 26일~28일');
    expect(formatDayRange({ from: '2026-10-26', to: '2026-11-01' })).toBe('10월 26일~11월 1일');
    expect(formatDayRange({ from: '2026-12-28', to: '2027-01-03' })).toBe('12월 28일~1월 3일');
    expect(formatDayRange({ from: '2026-10-26', to: '2026-10-26' })).toBe('10월 26일');
  });

  it('joins this week and last week', () => {
    expect(
      formatWeekRanges({ from: '2026-10-26', to: '2026-10-28' }, { from: '2026-10-19', to: '2026-10-21' }),
    ).toBe('10월 26일~28일 vs 10월 19일~21일');
  });
});

describe('change formatting', () => {
  it('signs amounts', () => {
    expect(formatChange(13000)).toBe('+13,000');
    expect(formatChange(-4000)).toBe('−4,000');
    expect(formatChange(0)).toBe('0');
    expect(formatChange(100000000)).toBe('+100,000,000');
  });

  it('picks a tone', () => {
    expect(changeTone(1)).toBe('up');
    expect(changeTone(-1)).toBe('down');
    expect(changeTone(0)).toBe('none');
  });
});

describe('bars', () => {
  it('finds the max amount of either week', () => {
    expect(maxWeeklyAmount(rows)).toBe(21000);
    expect(maxWeeklyAmount([])).toBe(0);
    expect(maxWeeklyAmount([{ category: 'FOOD', thisWeekAmount: 0, lastWeekAmount: 9000, changeAmount: -9000 }])).toBe(9000);
  });

  it('computes percentages', () => {
    expect(barPercent(8000, 21000)).toBeCloseTo(38.1, 1);
    expect(barPercent(21000, 21000)).toBe(100);
    expect(barPercent(0, 9000)).toBe(0);
    expect(barPercent(0, 0)).toBe(0);
  });
});

describe('changeRowLabel', () => {
  it('describes increase, decrease and no change', () => {
    expect(changeRowLabel(cafe)).toBe('카페, 이번 주 21,000원, 지난주 8,000원, 13,000원 늘었어요');
    expect(changeRowLabel(food)).toBe('식비, 이번 주 12,000원, 지난주 16,000원, 4,000원 줄었어요');
    expect(changeRowLabel(transport)).toBe('교통, 이번 주 5,000원, 지난주 5,000원, 변화 없어요');
  });
});
