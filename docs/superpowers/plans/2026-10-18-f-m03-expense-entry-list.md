# F-M03 지출 입력·이번 달 내역 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 홈이나 이번 달 내역에서 지출을 기록하면 이번 달 내역에 나타나고, 홈의 사용 금액·사용률·잔액·펫 상태가 바뀐다.

**Architecture:** API 클라이언트에 `createExpense`·`getMonthExpenses`를 더하고, 커서 무한 스크롤 상태는 `useMonthExpenses` 훅이 요청 세대 번호로 관리한다. 홈과 이번 달 내역은 Expo Router `useFocusEffect`로 포커스될 때마다 다시 조회한다. 새 화면 두 개는 루트 Stack의 `ready` guard 안에 둔다.

**Tech Stack:** Expo SDK 58, React Native 0.88, Expo Router 58(`useFocusEffect`, `router`), `@expo/ui/community/datetime-picker`(이미 설치됨), TypeScript 6, Jest 30 + `jest-expo` + RNTL 14(`render`·`renderHook`·`fireEvent`는 async), Maestro 2.11.

**Spec:** `docs/superpowers/specs/2026-10-18-f-m03-expense-entry-list-design.md`

## Global Constraints

- 새 의존성 없음. 날짜 선택기는 `import DateTimePicker from '@expo/ui/community/datetime-picker'`.
- 금액 1 ~ 100,000,000 원화 정수. 빈 금액 "금액을 입력해 주세요", 범위 밖 "1원부터 1억 원까지 입력할 수 있어요".
- 날짜 `YYYY-MM-DD`, 기본값 서울 기준 오늘, 범위 2000-01-01 ~ 서울 기준 오늘.
- 카테고리 코드 순서 `FOOD, CAFE, TRANSPORT, SHOPPING, HEALTH, LIVING, OTHER`, 이름 식비·카페·교통·쇼핑·건강·생활·기타. 미선택 저장 시 `OTHER`를 명시해 보낸다.
- 메모 최대 100자(유니코드 코드 포인트). 넘으면 "메모는 100자까지 입력할 수 있어요". 비었거나 공백만이면 `null`로 보낸다.
- 목록 `limit` 20, 커서는 해석하지 않고 URL 인코딩해 그대로 보낸다. `nextCursor: null`이면 더 요청하지 않는다. 다시 조회 시 커서를 버린다.
- 목록 행: 메모 있음 → 제목 메모, 보조 "{M}월 {D}일 · {카테고리}"; 메모 없음 → 제목 카테고리, 보조 "{M}월 {D}일"; 금액 "{N}원" 항상.
- 연결 오류 문구는 `CONNECTION_ERROR`("서버에 연결할 수 없어요. 다시 시도해 주세요.").
- 토큰·요청 본문을 로그에 남기지 않는다. 라우트 파일만 `src/app/`. 테스트는 `__tests__/`.
- 코드 작성 시 `.agents/skills/karpathy-guidelines/SKILL.md`. lint 규칙을 끄지 않는다.
- 커밋은 Conventional Commits, 끝에 작성 모델의 `Co-Authored-By` 줄.
- 계획 코드 블록 첫 줄의 `// <경로>` 주석은 파일 이름 표시이며 파일에 넣지 않는다.

## Review Focus

- 목록 끝에서 `onEndReached`가 연달아 두 번 호출됨 → 다음 페이지 요청은 한 번만(Task 5 테스트).
- 추가 로딩 실패 후 "다시 시도" → 같은 커서로 다시 요청하고 항목이 중복되지 않는다(Task 5 테스트).
- 카테고리를 골랐다가 다시 눌러 해제 → `OTHER`로 저장(Task 6 테스트).
- 홈이 이미 보이는 상태에서 포커스 다시 조회 → 로딩 화면으로 바뀌지 않고 기존 내용 유지(Task 8 테스트).
- 빈 목록·마지막 페이지에서 `onEndReached` → 요청하지 않는다(Task 5 테스트).

---

### Task 1: 금액 파싱 공유

**Files:**
- Modify: `src/lib/money.ts`, `src/app/budget.tsx`(import 이름만), `__tests__/money-test.ts`

**Interfaces:**
- Produces: `formatAmountInput(text: string): string`(기존 `formatBudgetInput` 이름 변경), `type AmountInput = { ok: true; amount: number } | { ok: false; error: string }`, `parseAmountInput(text: string, emptyError: string): AmountInput`, `parseBudgetInput(text: string): AmountInput`(= `parseAmountInput(text, '예산을 입력해 주세요')`)

- [ ] **Step 1: Update the tests**

`__tests__/money-test.ts`에서 `formatBudgetInput`을 모두 `formatAmountInput`으로 바꾸고(describe 이름 포함), `parseBudgetInput` describe 아래에 추가한다:

```ts
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
```

import 줄에 `parseAmountInput`을 추가한다.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/money-test.ts`
Expected: FAIL (`formatAmountInput`/`parseAmountInput`이 없음)

- [ ] **Step 3: Implement**

`src/lib/money.ts`에서 `BUDGET_MIN`/`BUDGET_MAX`를 `AMOUNT_MIN`/`AMOUNT_MAX`로, `formatBudgetInput`을 `formatAmountInput`으로 이름을 바꾸고, 파싱 부분을 다음으로 바꾼다:

```ts
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
```

`BudgetInput` 타입은 지운다(다른 곳에서 쓰지 않음; `grep -rn BudgetInput src __tests__`로 확인). `src/app/budget.tsx`의 `formatBudgetInput` import·호출을 `formatAmountInput`으로 바꾼다.

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/money-test.ts __tests__/budget-screen-test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/app/budget.tsx __tests__/money-test.ts
git commit -m "refactor: share amount parsing between budget and expenses"
```

---

### Task 2: 서울 기준 날짜 helper

**Files:**
- Modify: `src/lib/month.ts`
- Test: `__tests__/month-test.ts`

**Interfaces:**
- Produces: `dateToSeoulDay(date: Date): string`(YYYY-MM-DD), `todayInSeoul(now?: Date): string`, `seoulDayToDate(day: string): Date`(그날 서울 정오), `formatDay(day: string): string`("10월 7일")

- [ ] **Step 1: Write the failing tests** (`__tests__/month-test.ts` 끝에 추가, import에 네 함수 추가)

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/month-test.ts`
Expected: FAIL (함수 없음)

- [ ] **Step 3: Implement** (`src/lib/month.ts`에 추가)

```ts
export function dateToSeoulDay(date: Date): string {
  const seoul = new Date(date.getTime() + SEOUL_OFFSET_MS);
  const day = String(seoul.getUTCDate()).padStart(2, '0');
  return `${toMonth(seoul.getUTCFullYear(), seoul.getUTCMonth() + 1)}-${day}`;
}

export function todayInSeoul(now: Date = new Date()): string {
  return dateToSeoulDay(now);
}

// Noon keeps the same calendar day for any picker time zone rounding.
export function seoulDayToDate(day: string): Date {
  return new Date(`${day}T12:00:00+09:00`);
}

export function formatDay(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return `${month}월 ${date}일`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/month-test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/month.ts __tests__/month-test.ts
git commit -m "feat: add Seoul calendar-day helpers"
```

---

### Task 3: 지출 표시·메모 규칙

**Files:**
- Modify: `src/api/types.ts`(지출 타입 추가)
- Create: `src/lib/expense.ts`
- Test: `__tests__/expense-test.ts`

**Interfaces:**
- Consumes: `formatDay` (Task 2)
- Produces:
  - `src/api/types.ts`: `ExpenseCategory`, `Expense`, `NewExpense`, `ExpensePage`
  - `CATEGORIES: ExpenseCategory[]`, `CATEGORY_LABELS: Record<ExpenseCategory, string>`
  - `type MemoInput = { ok: true; memo: string | null } | { ok: false; error: string }`, `parseMemo(text: string): MemoInput`
  - `expenseRowText(expense: Pick<Expense, 'expenseDate' | 'category' | 'memo'>): { title: string; subtitle: string }`

- [ ] **Step 1: Add the types** (`src/api/types.ts` 끝에 추가)

```ts
export type ExpenseCategory = 'FOOD' | 'CAFE' | 'TRANSPORT' | 'SHOPPING' | 'HEALTH' | 'LIVING' | 'OTHER';

export type Expense = {
  id: number;
  amount: number;
  expenseDate: string;
  category: ExpenseCategory;
  memo: string | null;
};

export type NewExpense = Omit<Expense, 'id'>;

export type ExpensePage = { items: Expense[]; nextCursor: string | null };
```

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/expense-test.ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/expense-test.ts`
Expected: FAIL (`@/lib/expense` 없음)

- [ ] **Step 4: Implement**

```ts
// src/lib/expense.ts
import type { Expense, ExpenseCategory } from '@/api/types';

import { formatDay } from './month';

export const CATEGORIES: ExpenseCategory[] = ['FOOD', 'CAFE', 'TRANSPORT', 'SHOPPING', 'HEALTH', 'LIVING', 'OTHER'];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: '식비',
  CAFE: '카페',
  TRANSPORT: '교통',
  SHOPPING: '쇼핑',
  HEALTH: '건강',
  LIVING: '생활',
  OTHER: '기타',
};

const MEMO_MAX = 100;

export type MemoInput = { ok: true; memo: string | null } | { ok: false; error: string };

export function parseMemo(text: string): MemoInput {
  if (text.trim() === '') return { ok: true, memo: null };
  // The server counts Unicode code points, so an emoji is one character.
  if ([...text].length > MEMO_MAX) return { ok: false, error: '메모는 100자까지 입력할 수 있어요' };
  return { ok: true, memo: text };
}

export function expenseRowText(expense: Pick<Expense, 'expenseDate' | 'category' | 'memo'>) {
  const day = formatDay(expense.expenseDate);
  const label = CATEGORY_LABELS[expense.category];
  return expense.memo ? { title: expense.memo, subtitle: `${day} · ${label}` } : { title: label, subtitle: day };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/expense-test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/lib/expense.ts __tests__/expense-test.ts
git commit -m "feat: add expense categories, memo rule, and list row text"
```

---

### Task 4: 지출 API

**Files:**
- Modify: `src/api/client.ts`
- Test: `__tests__/api-client-test.ts`

**Interfaces:**
- Consumes: `NewExpense`, `Expense`, `ExpensePage` (Task 3)
- Produces: `ApiClient.createExpense(body: NewExpense): Promise<Expense>`, `ApiClient.getMonthExpenses(month: string, cursor?: string): Promise<ExpensePage>`(항상 `limit=20`)

- [ ] **Step 1: Write the failing tests** (`__tests__/api-client-test.ts` 끝에 추가. 파일에 이미 있는 `jsonResponse`, `setup`, `handler`, `fetchMock`, `bearer`를 쓴다)

```ts
test('creates an expense with the given body', async () => {
  const body = { amount: 12000, expenseDate: '2026-10-17', category: 'OTHER', memo: null } as const;
  handler = (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      return jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 });
    }
    expect(url).toBe(`${BASE}/expenses`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(body);
    return jsonResponse(201, { id: 42, ...body });
  };
  const { api } = setup('r0');
  await api.restoreSession();

  await expect(api.createExpense(body)).resolves.toEqual({ id: 42, ...body });
});

test('requests a month page with limit 20 and an encoded cursor', async () => {
  const urls: string[] = [];
  handler = (url) => {
    urls.push(url);
    return jsonResponse(200, { items: [], nextCursor: null });
  };
  const { api } = setup();

  await api.getMonthExpenses('2026-10');
  await api.getMonthExpenses('2026-10', 'a+b/c=');

  expect(urls).toEqual([
    `${BASE}/months/2026-10/expenses?limit=20`,
    `${BASE}/months/2026-10/expenses?limit=20&cursor=a%2Bb%2Fc%3D`,
  ]);
});
```

(`BASE`와 `handler`는 파일 위쪽에 정의돼 있다. `handler`의 `init` 인자가 없는 테스트는 그대로 둔다.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api-client-test.ts`
Expected: FAIL (`createExpense` 없음)

- [ ] **Step 3: Implement**

`src/api/client.ts`의 import에 `Expense`, `ExpensePage`, `NewExpense`를 추가하고, 파일 위쪽 상수로:

```ts
const EXPENSE_PAGE_SIZE = 20;
```

반환 객체의 `getHome` 아래에 추가:

```ts
    createExpense: (body: NewExpense) => request<Expense>('POST', '/expenses', body),
    // The cursor is opaque: pass it back exactly as received.
    getMonthExpenses: (month: string, cursor?: string) =>
      request<ExpensePage>(
        'GET',
        `/months/${month}/expenses?limit=${EXPENSE_PAGE_SIZE}` +
          (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''),
      ),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api-client-test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts __tests__/api-client-test.ts
git commit -m "feat: add expense create and month list API calls"
```

---

### Task 5: 월 목록 훅

**Files:**
- Create: `src/hooks/use-month-expenses.ts`
- Test: `__tests__/use-month-expenses-test.ts`

**Interfaces:**
- Consumes: `ApiClient`, `ApiError` (Task 4), `Expense`, `ExpensePage` (Task 3)
- Produces: `useMonthExpenses(api: Pick<ApiClient, 'getMonthExpenses'>, month: string): MonthExpenses` where
  `MonthExpenses = { status: 'loading' | 'error' | 'ready'; items: Expense[]; hasMore: boolean; loadingMore: boolean; moreError: boolean; reload: () => void; loadMore: () => void }`.
  `reload`과 `loadMore`는 `api`·`month`가 같으면 같은 참조를 유지한다(`useFocusEffect`에 넘긴다). 훅은 처음에 스스로 조회하지 않는다. 호출하는 화면이 `reload`를 부른다.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/use-month-expenses-test.ts
import { act, renderHook } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import type { Expense, ExpensePage } from '@/api/types';
import { useMonthExpenses } from '@/hooks/use-month-expenses';

function expense(id: number): Expense {
  return { id, amount: 1000, expenseDate: '2026-10-17', category: 'OTHER', memo: null };
}

function page(ids: number[], nextCursor: string | null): ExpensePage {
  return { items: ids.map(expense), nextCursor };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function setup(getMonthExpenses: jest.Mock) {
  const api = { getMonthExpenses };
  const hook = await renderHook(() => useMonthExpenses(api, '2026-10'));
  return hook;
}

async function flush() {
  await act(async () => {});
}

test('loads the first page and appends the next one', async () => {
  const get = jest.fn().mockResolvedValueOnce(page([3, 2], 'c1')).mockResolvedValueOnce(page([1], null));
  const { result } = await setup(get);

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2]);
  expect(result.current.hasMore).toBe(true);

  await act(async () => result.current.loadMore());
  expect(get).toHaveBeenLastCalledWith('2026-10', 'c1');
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
  expect(result.current.hasMore).toBe(false);
});

test('does not request past the last page or on an empty list', async () => {
  const get = jest.fn().mockResolvedValue(page([], null));
  const { result } = await setup(get);

  await act(async () => result.current.reload());
  await act(async () => result.current.loadMore());

  expect(get).toHaveBeenCalledTimes(1);
});

test('sends one request when loadMore fires twice', async () => {
  const next = deferred<ExpensePage>();
  const get = jest.fn().mockResolvedValueOnce(page([3, 2], 'c1')).mockReturnValueOnce(next.promise);
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  act(() => {
    result.current.loadMore();
    result.current.loadMore();
  });
  expect(get).toHaveBeenCalledTimes(2);
  expect(result.current.loadingMore).toBe(true);

  await act(async () => next.resolve(page([1], null)));
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
});

test('keeps items when loading more fails and retries the same cursor without duplicates', async () => {
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([3, 2], 'c1'))
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce(page([1], null));
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  await act(async () => result.current.loadMore());
  expect(result.current.moreError).toBe(true);
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2]);

  await act(async () => result.current.loadMore());
  expect(get).toHaveBeenLastCalledWith('2026-10', 'c1');
  expect(result.current.moreError).toBe(false);
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
});

test('reports an error when the first page fails and recovers on reload', async () => {
  const get = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(page([1], null));
  const { result } = await setup(get);

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('error');

  await act(async () => result.current.reload());
  expect(result.current.status).toBe('ready');
});

test('reload drops the cursor and ignores a late page from before the reload', async () => {
  const late = deferred<ExpensePage>();
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([3, 2], 'c1'))
    .mockReturnValueOnce(late.promise)
    .mockResolvedValueOnce(page([4, 3, 2], 'c2'));
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  act(() => result.current.loadMore());
  await act(async () => result.current.reload());
  expect(get).toHaveBeenLastCalledWith('2026-10', undefined);

  await act(async () => late.resolve(page([1], null)));
  await flush();
  expect(result.current.items.map((e) => e.id)).toEqual([4, 3, 2]);
  expect(result.current.hasMore).toBe(true);
});

test('starts over from the first page on INVALID_CURSOR', async () => {
  const get = jest
    .fn()
    .mockResolvedValueOnce(page([3, 2], 'c1'))
    .mockRejectedValueOnce(new ApiError(400, 'INVALID_CURSOR'))
    .mockResolvedValueOnce(page([3, 2, 1], null));
  const { result } = await setup(get);
  await act(async () => result.current.reload());

  await act(async () => result.current.loadMore());
  await flush();

  expect(get).toHaveBeenLastCalledWith('2026-10', undefined);
  expect(result.current.items.map((e) => e.id)).toEqual([3, 2, 1]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/use-month-expenses-test.ts`
Expected: FAIL (`@/hooks/use-month-expenses` 없음)

- [ ] **Step 3: Implement**

```ts
// src/hooks/use-month-expenses.ts
import { useCallback, useRef, useState } from 'react';

import { ApiError, type ApiClient } from '@/api/client';
import type { Expense } from '@/api/types';

type ListState = {
  status: 'loading' | 'error' | 'ready';
  items: Expense[];
  nextCursor: string | null;
  loadingMore: boolean;
  moreError: boolean;
};

const INITIAL: ListState = { status: 'loading', items: [], nextCursor: null, loadingMore: false, moreError: false };

export type MonthExpenses = Omit<ListState, 'nextCursor'> & {
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
};

export function useMonthExpenses(api: Pick<ApiClient, 'getMonthExpenses'>, month: string): MonthExpenses {
  const [state, setState] = useState<ListState>(INITIAL);
  // Each reload starts a new generation; responses from older generations are ignored.
  const generation = useRef(0);
  const inFlight = useRef(false);
  const cursorRef = useRef<string | null>(null);

  const fetchPage = useCallback(
    (cursor: string | null) => {
      const gen = generation.current;
      inFlight.current = true;
      api.getMonthExpenses(month, cursor ?? undefined).then(
        (page) => {
          if (gen !== generation.current) return;
          inFlight.current = false;
          cursorRef.current = page.nextCursor;
          setState((s) => ({
            status: 'ready',
            items: cursor ? [...s.items, ...page.items] : page.items,
            nextCursor: page.nextCursor,
            loadingMore: false,
            moreError: false,
          }));
        },
        (error: unknown) => {
          if (gen !== generation.current) return;
          inFlight.current = false;
          if (cursor && error instanceof ApiError && error.code === 'INVALID_CURSOR') {
            generation.current += 1;
            cursorRef.current = null;
            fetchPage(null);
            return;
          }
          setState((s) => (cursor ? { ...s, loadingMore: false, moreError: true } : { ...INITIAL, status: 'error' }));
        },
      );
    },
    [api, month],
  );

  const reload = useCallback(() => {
    generation.current += 1;
    cursorRef.current = null;
    setState(INITIAL);
    fetchPage(null);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor || inFlight.current) return;
    setState((s) => ({ ...s, loadingMore: true, moreError: false }));
    fetchPage(cursor);
  }, [fetchPage]);

  const { nextCursor, ...rest } = state;
  return { ...rest, hasMore: nextCursor !== null, reload, loadMore };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/use-month-expenses-test.ts`
Expected: PASS (7 tests). `act()` 경고가 없어야 한다.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint && npm run typecheck`
Expected: exit 0

```bash
git add src/hooks/use-month-expenses.ts __tests__/use-month-expenses-test.ts
git commit -m "feat: add month expense list hook with cursor paging"
```

---

### Task 6: 지출 입력 화면과 라우트 등록

**Files:**
- Create: `src/app/expenses/new.tsx`
- Modify: `src/app/_layout.tsx`(ready guard에 두 화면 추가)
- Test: `__tests__/new-expense-screen-test.tsx`

**Interfaces:**
- Consumes: `useSession` → `api.createExpense` (Task 4), `ApiError`, `CATEGORIES`, `CATEGORY_LABELS`, `parseMemo` (Task 3), `formatAmountInput`, `parseAmountInput` (Task 1), `dateToSeoulDay`, `seoulDayToDate`, `todayInSeoul` (Task 2), `Button`, `errorMessage`
- Produces: 화면 접근성 이름 — 금액 입력 `지출 금액`, 메모 입력 `메모`, 날짜 선택기 `testID="expense-date"`, 카테고리 칩 이름 = 카테고리 이름(radio), 저장 버튼 `저장`. 라우트 `/expenses/new`, `/expenses`.

- [ ] **Step 1: Register both routes in the root layout**

`src/app/_layout.tsx`의 ready guard를 다음으로 바꾼다:

```tsx
      <Stack.Protected guard={stage === 'ready'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="expenses/new" options={{ headerShown: true, title: '지출 기록', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="expenses/index" options={{ headerShown: true, title: '이번 달 내역', headerBackTitle: '뒤로' }} />
      </Stack.Protected>
```

- [ ] **Step 2: Write the failing test**

```tsx
// __tests__/new-expense-screen-test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ApiError } from '@/api/client';
import NewExpenseScreen from '@/app/expenses/new';
import { todayInSeoul } from '@/lib/month';

const mockApi = { createExpense: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() } }));

// The SwiftUI picker is native; render its value so tests can see it.
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { createElement } = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: { testID?: string; value: Date }) =>
      createElement(Text, { testID: props.testID }, props.value.toISOString()),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockApi.createExpense.mockResolvedValue({ id: 1 });
});

async function fillAmount(value: string) {
  await fireEvent.changeText(screen.getByLabelText('지출 금액'), value);
}

test('saves today as OTHER with a null memo by default and goes back', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith({
    amount: 12000,
    expenseDate: todayInSeoul(),
    category: 'OTHER',
    memo: null,
  });
  expect(router.back).toHaveBeenCalledTimes(1);
});

test('sends the chosen category and memo', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.changeText(screen.getByLabelText('메모'), '라떼');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.createExpense).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'CAFE', memo: '라떼' }));
});

test('sends OTHER after a category is selected and then unselected', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('5000');
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.press(screen.getByRole('radio', { name: '카페' }));
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));
  expect(mockApi.createExpense).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'OTHER' }));
});

test('sends a whitespace-only memo as null', async () => {
  await render(<NewExpenseScreen />);
  await fillAmount('3000');
  await fireEvent.changeText(screen.getByLabelText('메모'), '   ');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  expect(mockApi.createExpense).toHaveBeenCalledWith(expect.objectContaining({ memo: null }));
});

test('disables saving for an empty amount or a 101-character memo', async () => {
  await render(<NewExpenseScreen />);
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  screen.getByText('금액을 입력해 주세요');

  await fillAmount('1000');
  await fireEvent.changeText(screen.getByLabelText('메모'), '가'.repeat(101));
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  screen.getByText('메모는 100자까지 입력할 수 있어요');
});

test('shows server field errors and keeps the input', async () => {
  mockApi.createExpense.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'expenseDate', message: '미래 날짜는 입력할 수 없어요' }]),
  );
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('미래 날짜는 입력할 수 없어요');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('12,000');
  expect(router.back).not.toHaveBeenCalled();
});

test('shows the connection message on a network error', async () => {
  mockApi.createExpense.mockRejectedValue(new TypeError('Network request failed'));
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  expect(screen.getByLabelText('지출 금액')).toHaveDisplayValue('12,000');
});

test('sends one request when save is pressed twice', async () => {
  mockApi.createExpense.mockReturnValue(new Promise(() => {}));
  await render(<NewExpenseScreen />);
  await fillAmount('12000');
  const save = screen.getByRole('button', { name: '저장' });
  await fireEvent.press(save);
  await fireEvent.press(save);

  expect(mockApi.createExpense).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/new-expense-screen-test.tsx`
Expected: FAIL (`@/app/expenses/new` 없음)

- [ ] **Step 4: Implement**

```tsx
// src/app/expenses/new.tsx
import DateTimePicker from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { ExpenseCategory } from '@/api/types';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { CATEGORIES, CATEGORY_LABELS, parseMemo } from '@/lib/expense';
import { formatAmountInput, parseAmountInput } from '@/lib/money';
import { dateToSeoulDay, seoulDayToDate, todayInSeoul } from '@/lib/month';
import { useSession } from '@/session/session-provider';

const MIN_DATE = seoulDayToDate('2000-01-01');

type FieldErrors = Partial<Record<'amount' | 'expenseDate' | 'category' | 'memo', string>>;

export default function NewExpenseScreen() {
  const { api } = useSession();
  const [amountText, setAmountText] = useState('');
  const [day, setDay] = useState(() => todayInSeoul());
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [memoText, setMemoText] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const amount = parseAmountInput(amountText, '금액을 입력해 주세요');
  const memo = parseMemo(memoText);

  async function save() {
    if (!amount.ok || !memo.ok || saving) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await api.createExpense({ amount: amount.amount, expenseDate: day, category: category ?? 'OTHER', memo: memo.memo });
      router.back();
    } catch (e) {
      const fields = e instanceof ApiError ? e.fields : [];
      if (fields.length > 0) setFieldErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
      else setFormError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>금액</Text>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="지출 금액"
                keyboardType="number-pad"
                value={amountText}
                onChangeText={(t) => setAmountText(formatAmountInput(t))}
                placeholder="0"
                style={styles.amountInput}
              />
              <Text style={styles.unit}>원</Text>
            </View>
            {!amount.ok && <Text style={styles.hint}>{amount.error}</Text>}
            {fieldErrors.amount && <Text style={styles.error}>{fieldErrors.amount}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>날짜</Text>
            <DateTimePicker
              testID="expense-date"
              value={seoulDayToDate(day)}
              mode="date"
              display="compact"
              minimumDate={MIN_DATE}
              maximumDate={seoulDayToDate(todayInSeoul())}
              timeZoneName="Asia/Seoul"
              locale="ko_KR"
              onValueChange={(_, selected) => setDay(dateToSeoulDay(selected))}
            />
            {fieldErrors.expenseDate && <Text style={styles.error}>{fieldErrors.expenseDate}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>카테고리</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityLabel={CATEGORY_LABELS[c]}
                  accessibilityState={{ selected: category === c }}
                  onPress={() => setCategory((current) => (current === c ? null : c))}
                  style={[styles.chip, category === c && styles.chipSelected]}>
                  <Text style={[styles.chipLabel, category === c && styles.chipLabelSelected]}>{CATEGORY_LABELS[c]}</Text>
                </Pressable>
              ))}
            </View>
            {fieldErrors.category && <Text style={styles.error}>{fieldErrors.category}</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>메모</Text>
            <TextInput
              accessibilityLabel="메모"
              value={memoText}
              onChangeText={setMemoText}
              placeholder="선택"
              style={styles.memoInput}
            />
            {!memo.ok && <Text style={styles.error}>{memo.error}</Text>}
            {fieldErrors.memo && <Text style={styles.error}>{fieldErrors.memo}</Text>}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {formError && <Text style={styles.error}>{formError}</Text>}
          <Button label="저장" onPress={() => void save()} disabled={!amount.ok || !memo.ok} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  form: { padding: 24, gap: 24 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: '#208AEF' },
  amountInput: { flex: 1, fontSize: 28, paddingVertical: 8, color: '#111' },
  unit: { fontSize: 24, color: '#111' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { borderColor: '#208AEF', backgroundColor: '#EAF4FE' },
  chipLabel: { fontSize: 15, color: '#333' },
  chipLabelSelected: { color: '#1565C0', fontWeight: '600' },
  memoInput: { borderBottomWidth: 1, borderColor: '#D1D5DB', fontSize: 16, paddingVertical: 8, color: '#111' },
  hint: { color: '#555' },
  error: { color: '#D93025' },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/new-expense-screen-test.tsx`
Expected: PASS (8 tests), act() 경고 없음

- [ ] **Step 6: Run checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 모두 exit 0. `expo-router`의 typed routes가 아직 없는 `expenses/index` 파일 때문에 타입 오류를 내면, 오류 문구를 보고에 적고 Task 7에서 파일이 생기면 해결되는지 확인한다(라우트 이름을 바꾸지 않는다).

- [ ] **Step 7: Commit**

```bash
git add src/app/_layout.tsx src/app/expenses/new.tsx __tests__/new-expense-screen-test.tsx
git commit -m "feat: add expense entry screen"
```

---

### Task 7: 이번 달 내역 화면

**Files:**
- Create: `src/components/expense-row.tsx`, `src/app/expenses/index.tsx`
- Test: `__tests__/month-expenses-screen-test.tsx`

**Interfaces:**
- Consumes: `useMonthExpenses` (Task 5), `expenseRowText` (Task 3), `formatWon`, `currentMonth`, `monthTitle`, `Button`, `LoadingView`, `MessageView`, `CONNECTION_ERROR`, `useSession`
- Produces: 라우트 `/expenses`. 빈 목록 문구 "아직 기록한 지출이 없어요", 끝 문구 "모든 내역을 불러왔어요".

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/month-expenses-screen-test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import MonthExpensesScreen from '@/app/expenses';

const mockApi = { getMonthExpenses: jest.fn() };

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi }),
}));

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(() => effect(), [effect]),
  };
});

beforeEach(() => jest.clearAllMocks());

test('shows rows with title, subtitle, and amount, then the end message', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({
    items: [
      { id: 2, amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' },
      { id: 1, amount: 5000, expenseDate: '2026-10-07', category: 'OTHER', memo: null },
    ],
    nextCursor: null,
  });
  await render(<MonthExpensesScreen />);

  await screen.findByText('라떼');
  screen.getByText('10월 17일 · 카페');
  screen.getByText('12,000원');
  screen.getByText('기타');
  screen.getByText('10월 7일');
  screen.getByText('모든 내역을 불러왔어요');
});

test('shows the empty state with a record button', async () => {
  mockApi.getMonthExpenses.mockResolvedValue({ items: [], nextCursor: null });
  await render(<MonthExpensesScreen />);

  await screen.findByText('아직 기록한 지출이 없어요');
  expect(screen.queryByText('모든 내역을 불러왔어요')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '지출 기록하기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses/new');
});

test('offers a retry when the first page fails', async () => {
  mockApi.getMonthExpenses
    .mockRejectedValueOnce(new TypeError('Network request failed'))
    .mockResolvedValueOnce({ items: [], nextCursor: null });
  await render(<MonthExpensesScreen />);

  await screen.findByText('서버에 연결할 수 없어요. 다시 시도해 주세요.');
  await fireEvent.press(screen.getByRole('button', { name: '다시 시도' }));

  await screen.findByText('아직 기록한 지출이 없어요');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/month-expenses-screen-test.tsx`
Expected: FAIL (`@/app/expenses` 없음)

- [ ] **Step 3: Implement the row**

```tsx
// src/components/expense-row.tsx
import { StyleSheet, Text, View } from 'react-native';

import type { Expense } from '@/api/types';
import { expenseRowText } from '@/lib/expense';
import { formatWon } from '@/lib/money';

export function ExpenseRow({ expense }: { expense: Expense }) {
  const { title, subtitle } = expenseRowText(expense);
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.amount}>{formatWon(expense.amount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 16, color: '#111' },
  subtitle: { fontSize: 13, color: '#666' },
  amount: { fontSize: 16, fontWeight: '600', color: '#111' },
});
```

- [ ] **Step 4: Implement the screen**

```tsx
// src/app/expenses/index.tsx
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ExpenseRow } from '@/components/expense-row';
import { LoadingView, MessageView } from '@/components/message-view';
import { useMonthExpenses } from '@/hooks/use-month-expenses';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { currentMonth, monthTitle } from '@/lib/month';
import { useSession } from '@/session/session-provider';

export default function MonthExpensesScreen() {
  const { api } = useSession();
  const month = currentMonth();
  const list = useMonthExpenses(api, month);

  // Back from the entry screen (or any return) → start over from the first page.
  useFocusEffect(list.reload);

  if (list.status === 'loading') return <LoadingView />;
  if (list.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={list.reload} />;

  const openEntry = () => router.push('/expenses/new');

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ExpenseRow expense={item} />}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.month}>{monthTitle(month)}</Text>
          <Button label="지출 기록하기" onPress={openEntry} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.message}>아직 기록한 지출이 없어요</Text>}
      ListFooterComponent={
        list.loadingMore ? (
          <ActivityIndicator style={styles.footer} />
        ) : list.moreError ? (
          <View style={styles.footer}>
            <Button label="다시 시도" onPress={list.loadMore} />
          </View>
        ) : !list.hasMore && list.items.length > 0 ? (
          <Text style={[styles.message, styles.footer]}>모든 내역을 불러왔어요</Text>
        ) : null
      }
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  header: { gap: 16, marginBottom: 8 },
  month: { fontSize: 16, color: '#555' },
  separator: { height: 1, backgroundColor: '#EEF0F3' },
  message: { textAlign: 'center', color: '#666', marginTop: 24 },
  footer: { marginTop: 16 },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest __tests__/month-expenses-screen-test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Run checks and commit**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 모두 exit 0

```bash
git add src/components/expense-row.tsx src/app/expenses/index.tsx __tests__/month-expenses-screen-test.tsx
git commit -m "feat: add current-month expense list with infinite scroll"
```

---

### Task 8: 홈 연결과 포커스 다시 조회

**Files:**
- Modify: `src/app/index.tsx`, `__tests__/home-screen-test.tsx`

**Interfaces:**
- Consumes: `router`, `useFocusEffect` (expo-router), `Button`
- Produces: 홈 "지출 기록" 칸의 버튼 `지출 기록하기`(→ `/expenses/new`), 링크 `이번 달 내역 보기`(→ `/expenses`).

- [ ] **Step 1: Update the tests**

`__tests__/home-screen-test.tsx` 위쪽(다른 `jest.mock` 옆)에 추가한다. 포커스 효과를 테스트에서 다시 실행할 수 있게 마지막 효과를 잡아 둔다:

```tsx
import { router } from 'expo-router';

let mockFocusEffect: (() => void) | undefined;

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (effect: () => void) => {
      mockFocusEffect = effect;
      useEffect(() => effect(), [effect]);
    },
  };
});
```

파일 끝에 테스트를 추가한다:

```tsx
test('links to expense entry and the month list', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '지출 기록하기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses/new');
  await fireEvent.press(screen.getByRole('link', { name: '이번 달 내역 보기' }));
  expect(router.push).toHaveBeenCalledWith('/expenses');
});

test('refetches on focus without replacing the loaded home with a spinner', async () => {
  const next = new Promise(() => {});
  mockApi.getHome.mockResolvedValueOnce(HOME).mockReturnValueOnce(next);
  await render(<HomeScreen />);
  await screen.findByText('고양이 · 안정');

  await act(async () => mockFocusEffect?.());

  expect(mockApi.getHome).toHaveBeenCalledTimes(2);
  screen.getByText('고양이 · 안정');
});

test('shows the new totals after a focus refetch', async () => {
  mockApi.getHome.mockResolvedValueOnce(HOME).mockResolvedValueOnce({
    ...HOME,
    petState: 'CAUTION',
    spentAmount: 162000,
    usagePercent: 54,
    budgetBalanceAmount: 138000,
  });
  await render(<HomeScreen />);
  await screen.findByText('300,000원 남았어요');

  await act(async () => mockFocusEffect?.());

  await screen.findByText('고양이 · 주의');
  screen.getByText('138,000원 남았어요');
  screen.getByText('사용률 54%');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/home-screen-test.tsx`
Expected: FAIL (버튼·링크 없음, getHome 호출 횟수 불일치)

- [ ] **Step 3: Implement**

`src/app/index.tsx`에서:

1. import: `import { router, useFocusEffect } from 'expo-router';`, `Pressable`을 react-native import에 추가, `import { Button } from '@/components/button';`. `useEffect`는 AppState 효과에 계속 쓴다.
2. 처음 불러오기 `useEffect(() => { fetchHome(); }, [fetchHome]);`를 지우고 다음으로 바꾼다(포커스는 처음 표시 때도 실행된다):

```tsx
  // Runs on first display and every return to this screen (e.g. after saving an expense).
  useFocusEffect(
    useCallback(() => {
      fetchHome();
    }, [fetchHome]),
  );
```

3. "지출 기록" 카드를 다음으로 바꾼다:

```tsx
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>지출 기록</Text>
          {home.spentAmount === 0 && <Text style={styles.body}>첫 지출을 기록해 보세요</Text>}
          <Button label="지출 기록하기" onPress={() => router.push('/expenses/new')} />
          <Pressable accessibilityRole="link" accessibilityLabel="이번 달 내역 보기" onPress={() => router.push('/expenses')}>
            <Text style={styles.link}>이번 달 내역 보기</Text>
          </Pressable>
        </View>
```

4. styles에 추가: `link: { fontSize: 15, color: '#1565C0', textAlign: 'center', paddingVertical: 8 },`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/home-screen-test.tsx`
Expected: PASS (기존 테스트 포함). 기존 AppState 테스트가 `getHome` 호출 횟수를 셀 때 포커스 효과 1회를 기준으로 그대로 맞는지 확인한다.

- [ ] **Step 5: Run checks and commit**

Run: `npm run lint && npm run typecheck && npm test && npx expo export --platform ios --output-dir "$TMPDIR/petgyebu-export-f-m03"`
Expected: 모두 성공

```bash
git add src/app/index.tsx __tests__/home-screen-test.tsx
git commit -m "feat: link home to expense entry and list and refetch on focus"
```

---

### Task 9: Maestro 시나리오, 시뮬레이터 확인, PR

**Files:**
- Create: `.maestro/expenses/record-and-list.yaml`, `.maestro/expenses/validation.yaml`, `.maestro/expenses/paging.yaml`, `.maestro/expenses/list-server-unavailable.yaml`
- Modify: `README.md`(Maestro 시나리오 표에 지출 시나리오 추가)

- [ ] **Step 1: Write the flows**

```yaml
# .maestro/expenses/record-and-list.yaml
# 지출 기록 → 홈 갱신 → 이번 달 내역. 준비: first-login 직후(예산 300,000원, 지출 0건).
appId: host.exp.Exponent
env:
  APP_URL: exp://127.0.0.1:8081
---
- runFlow: ../subflows/open-app.yaml
- extendedWaitUntil: { visible: "고양이 · 안정", timeout: 120000 }
- tapOn: "지출 기록하기"
# The home card is also titled "지출 기록", so wait for something only the entry screen shows.
- extendedWaitUntil: { visible: "금액을 입력해 주세요", timeout: 20000 }
- tapOn: "지출 금액"
- inputText: "12000"
- tapOn: "카페"
- tapOn: "메모"
- inputText: "라떼"
- waitForAnimationToEnd
- tapOn: "저장"
- extendedWaitUntil: { visible: "288,000원 남았어요", timeout: 20000 }
- assertVisible: "사용률 4%"
- tapOn: "지출 기록하기"
- tapOn: "지출 금액"
- inputText: "5000"
- waitForAnimationToEnd
- tapOn: "저장"
- extendedWaitUntil: { visible: "283,000원 남았어요", timeout: 20000 }
- tapOn: "지출 기록하기"
- tapOn: "지출 금액"
- inputText: "150000"
- waitForAnimationToEnd
- tapOn: "저장"
- extendedWaitUntil: { visible: "고양이 · 주의", timeout: 20000 }
- tapOn: "이번 달 내역 보기"
- extendedWaitUntil: { visible: "라떼", timeout: 20000 }
- assertVisible: ".*월 .*일 · 카페"
- assertVisible: "12,000원"
- assertVisible: "기타"
- assertVisible: "5,000원"
- assertVisible: "모든 내역을 불러왔어요"
```

```yaml
# .maestro/expenses/validation.yaml
# 빈 금액·101자 메모는 저장 비활성. 준비: 홈.
appId: host.exp.Exponent
env:
  APP_URL: exp://127.0.0.1:8081
---
- runFlow: ../subflows/open-app.yaml
- extendedWaitUntil: { visible: "지출 기록하기", timeout: 120000 }
- tapOn: "지출 기록하기"
- extendedWaitUntil: { visible: "금액을 입력해 주세요", timeout: 20000 }
- assertVisible: { text: "저장", enabled: false }
- tapOn: "지출 금액"
- inputText: "1000"
- tapOn: "메모"
- inputText: "가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가나다라마바사아자차가"
- assertVisible: "메모는 100자까지 입력할 수 있어요"
- assertVisible: { text: "저장", enabled: false }
```

```yaml
# .maestro/expenses/paging.yaml
# 25건 무한 스크롤. 준비: README의 SQL로 현재 계정에 이번 달 지출 25건(memo 'p01'~'p25').
appId: host.exp.Exponent
env:
  APP_URL: exp://127.0.0.1:8081
---
- runFlow: ../subflows/open-app.yaml
- extendedWaitUntil: { visible: "이번 달 내역 보기", timeout: 120000 }
- tapOn: "이번 달 내역 보기"
- extendedWaitUntil: { visible: "p25", timeout: 20000 }
- scrollUntilVisible:
    element: "모든 내역을 불러왔어요"
    direction: DOWN
    timeout: 30000
- assertVisible: "p01"
```

```yaml
# .maestro/expenses/list-server-unavailable.yaml
# 백엔드 중지 상태에서 내역 → 오류와 다시 시도. 준비: 홈이 열린 상태에서 백엔드 중지.
appId: host.exp.Exponent
---
- tapOn: "이번 달 내역 보기"
- extendedWaitUntil: { visible: "서버에 연결할 수 없어요. 다시 시도해 주세요.", timeout: 30000 }
- assertVisible: "다시 시도"
```

README의 시나리오 표 아래에 지출 시나리오 4개(파일·확인 내용·준비)와 25건 준비 SQL을 추가한다:

```bash
# 이번 달 지출 25건 넣기: 로컬 개발 DB에만 실행
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "INSERT INTO expenses (user_id, amount, expense_date, category, memo) \
   SELECT u.id, 1000, (now() AT TIME ZONE 'Asia/Seoul')::date, 'OTHER', 'p' || lpad(g::text, 2, '0') \
   FROM users u, generate_series(1, 25) g WHERE u.provider = 'KAKAO' AND u.provider_user_id = '<개발용 ID>';"
```

(컬럼은 백엔드 `V1__baseline.sql`의 `expenses` 테이블과 일치함을 확인했다.)

- [ ] **Step 2: Check syntax**

Run: `for f in .maestro/expenses/*.yaml; do maestro check-syntax $f; done`
Expected: 모두 OK

- [ ] **Step 3: Run on the simulator** (controller)

백엔드 `bootTestRun`, Metro, iPhone 18 Pro(iOS 27.0)를 준비하고 README 절차대로:
1. 새 개발용 ID → `onboarding/first-login.yaml` → `expenses/record-and-list.yaml`(spec 시나리오 1·2·3)
2. `expenses/validation.yaml`(시나리오 6)
3. 새 개발용 ID로 first-login → SQL 25건 → `expenses/paging.yaml`(시나리오 4)
4. 시나리오 5(지난달 날짜): Maestro로 SwiftUI compact 날짜 선택기를 열어 지난달 날짜를 고를 수 있으면 확인하고 DB에서 해당 행의 `expense_date`를 조회한다. 조작할 수 없으면 "미확인"으로 기록한다(날짜 변환은 Task 2 단위 테스트로 확인됨).
5. 홈에서 백엔드 중지 → `expenses/list-server-unavailable.yaml` → 백엔드 재시작 → "다시 시도" 눌러 목록 표시(시나리오 7)

각 결과를 스크린샷과 함께 기록한다.

- [ ] **Step 4: Commit flows and README**

```bash
git add .maestro/expenses README.md
git commit -m "chore: add Maestro flows for expense entry and list"
```

- [ ] **Step 5: Final review, push, PR, CI**

브랜치 전체 최종 검토(`app-qa`) 후 지적을 반영한다. 그다음 push하고 `develop`으로 PR을 연다. 본문: F-M03(입력·현재 월 목록)·F-M06 갱신, 사용 API(`POST /expenses`, `GET /months/{month}/expenses`, `GET /home`)와 계약 변경 없음, 시나리오별 결과, 실제 검사 결과, 남은 제한(수정·삭제는 다음 브랜치, 과거 월 목록은 F-M05, 미확인 시나리오). `gh pr checks --watch`로 CI 통과를 확인한다.
