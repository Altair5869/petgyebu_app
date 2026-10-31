// Advance widths in em of LINE Seed KR Bold, which has no tabular digits: '0' is the widest digit.
const DIGIT_EM = 0.67;
const SEPARATOR_EM = 0.27;
// Room for the caret at the end of the text; the fields set no horizontal padding.
const CARET_SLACK = 4;
const MIN_SIZE = 12;

// The largest font size, up to maxSize, at which the whole amount fits the field's width. A text
// field scrolls to the caret instead of wrapping, so an amount wider than the field loses its first
// digits at large accessibility text sizes.
export function fittedAmountFontSize(text: string, width: number, maxSize: number): number {
  if (width <= 0) return maxSize;
  const shown = text || '0';
  const digits = shown.replace(/\D/g, '').length;
  const em = digits * DIGIT_EM + (shown.length - digits) * SEPARATOR_EM;
  return Math.min(maxSize, Math.max(MIN_SIZE, Math.floor((width - CARET_SLACK) / em)));
}
