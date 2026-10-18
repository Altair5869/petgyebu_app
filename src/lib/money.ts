const AMOUNT_MIN = 1;
const AMOUNT_MAX = 100_000_000;

function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatWon(amount: number): string {
  return `${formatNumber(amount)}원`;
}

export function formatAmountInput(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
  return digits === '' ? '' : formatNumber(Number(digits));
}

export type AmountInput = { ok: true; amount: number } | { ok: false; error: string };

export function parseAmountInput(text: string, emptyError: string): AmountInput {
  const digits = text.replace(/,/g, '');
  if (digits === '') return { ok: false, error: emptyError };
  if (!/^\d+$/.test(digits)) return { ok: false, error: '숫자만 입력할 수 있어요' };
  const amount = Number(digits);
  if (amount < AMOUNT_MIN || amount > AMOUNT_MAX) {
    return { ok: false, error: '1원부터 1억 원까지 입력할 수 있어요' };
  }
  return { ok: true, amount };
}

export function parseBudgetInput(text: string): AmountInput {
  return parseAmountInput(text, '예산을 입력해 주세요');
}

// The API already truncates usagePercent to one decimal place.
export function formatUsagePercent(percent: number): string {
  return `${Number(percent.toFixed(1))}%`;
}

export function describeBalance(balance: number): string {
  if (balance > 0) return `${formatWon(balance)} 남았어요`;
  if (balance === 0) return '예산을 모두 사용했어요';
  return `${formatWon(-balance)} 초과했어요`;
}
