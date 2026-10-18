import {
  describeBalance,
  formatAmountInput,
  formatUsagePercent,
  formatWon,
  parseAmountInput,
  parseBudgetInput,
} from '@/lib/money';

describe('formatWon', () => {
  test('adds thousands separators and 원', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(1234567)).toBe('1,234,567원');
  });
});

describe('formatAmountInput', () => {
  test('keeps digits only and adds separators', () => {
    expect(formatAmountInput('12a3,4')).toBe('1,234');
  });

  test('drops leading zeros but keeps a single 0', () => {
    expect(formatAmountInput('00012')).toBe('12');
    expect(formatAmountInput('0')).toBe('0');
  });

  test('caps the length at 10 digits', () => {
    expect(formatAmountInput('123456789012')).toBe('1,234,567,890');
  });

  test('returns empty for no digits', () => {
    expect(formatAmountInput('abc')).toBe('');
  });
});

describe('parseBudgetInput', () => {
  test('requires a value', () => {
    expect(parseBudgetInput('')).toEqual({ ok: false, error: '예산을 입력해 주세요' });
  });

  test('accepts the range 1 to 100,000,000 with separators', () => {
    expect(parseBudgetInput('1')).toEqual({ ok: true, amount: 1 });
    expect(parseBudgetInput('100,000,000')).toEqual({ ok: true, amount: 100000000 });
  });

  test('rejects amounts outside the range', () => {
    const outOfRange = { ok: false, error: '1원부터 1억 원까지 입력할 수 있어요' };
    expect(parseBudgetInput('0')).toEqual(outOfRange);
    expect(parseBudgetInput('100,000,001')).toEqual(outOfRange);
  });

  test('rejects non-digit characters', () => {
    expect(parseBudgetInput('12a')).toEqual({ ok: false, error: '숫자만 입력할 수 있어요' });
  });
});

describe('parseAmountInput', () => {
  test('uses the given empty message and the shared range', () => {
    expect(parseAmountInput('', '금액을 입력해 주세요')).toEqual({ ok: false, error: '금액을 입력해 주세요' });
    expect(parseAmountInput('12,000', '금액을 입력해 주세요')).toEqual({ ok: true, amount: 12000 });
    expect(parseAmountInput('0', '금액을 입력해 주세요')).toEqual({
      ok: false,
      error: '1원부터 1억 원까지 입력할 수 있어요',
    });
  });
});

describe('formatUsagePercent', () => {
  test('hides a zero decimal', () => {
    expect(formatUsagePercent(55.0)).toBe('55%');
    expect(formatUsagePercent(0)).toBe('0%');
  });

  test('keeps one decimal place', () => {
    expect(formatUsagePercent(49.9)).toBe('49.9%');
  });
});

describe('describeBalance', () => {
  test('describes remaining, exactly used, and over budget', () => {
    expect(describeBalance(135000)).toBe('135,000원 남았어요');
    expect(describeBalance(0)).toBe('예산을 모두 사용했어요');
    expect(describeBalance(-10000)).toBe('10,000원 초과했어요');
  });
});
