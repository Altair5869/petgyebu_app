import { fittedAmountFontSize } from '@/lib/amount-font';

describe('fittedAmountFontSize', () => {
  test('keeps the scaled size when the amount fits', () => {
    expect(fittedAmountFontSize('100,000', 300, 32)).toBe(32);
    expect(fittedAmountFontSize('100,000', 300, 40)).toBe(40);
  });

  test('shrinks so the whole amount fits the measured width', () => {
    // 6 digits at the widest digit plus 1 comma: about 4.29em.
    const size = fittedAmountFontSize('100,000', 230, 75);
    expect(size).toBeLessThan(75);
    expect(size * (6 * 0.67 + 0.27)).toBeLessThanOrEqual(230);
  });

  test('fits the longest input the field accepts on a small screen', () => {
    const size = fittedAmountFontSize('1,234,567,890', 200, 100);
    expect(size * (10 * 0.67 + 3 * 0.27)).toBeLessThanOrEqual(200);
  });

  test('never goes below a readable size', () => {
    expect(fittedAmountFontSize('1,234,567,890', 3, 75)).toBe(12);
  });

  test('uses the placeholder width when empty', () => {
    expect(fittedAmountFontSize('', 300, 32)).toBe(32);
  });

  test('keeps the scaled size before the field is measured', () => {
    expect(fittedAmountFontSize('1,234,567,890', 0, 75)).toBe(75);
  });
});
