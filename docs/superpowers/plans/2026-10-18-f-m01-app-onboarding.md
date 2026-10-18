# F-M01 앱 온보딩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 처음 쓰는 사용자가 로그인 → 펫 선택 → 현재 월 예산 → 현재 월 홈까지 실제로 이동하고, 앱을 다시 열어도 로그인이 유지되는 앱 흐름을 만든다.

**Architecture:** `fetch` 래퍼 API 클라이언트(401 → 단일 갱신 → 1회 재시도)와 React Context `SessionProvider`가 세션 상태와 온보딩 단계(`pet`/`budget`/`ready`)를 관리한다. 루트 `_layout`은 단계에 맞는 화면 하나만 `Stack.Protected`로 연다. 틀리기 쉬운 로직은 `src/lib`의 순수 함수로 분리해 Jest로 고정한다.

**Tech Stack:** Expo SDK 58, React Native 0.88, React 19.3, Expo Router 58(`Stack.Protected`, `SplashScreen`), `expo-secure-store`, TypeScript 6, Jest 30 + `jest-expo` + `@testing-library/react-native` 14(`render`·`fireEvent`는 async).

**Spec:** `docs/superpowers/specs/2026-10-18-f-m01-app-onboarding-design.md`

## Global Constraints

- 새 런타임 의존성은 `expo-secure-store` 하나뿐이며 `npx expo install expo-secure-store`로 추가한다.
- 리프레시 토큰만 SecureStore에 저장하고 액세스 토큰은 메모리에만 둔다. 토큰은 로그·오류 메시지·콘솔에 남기지 않는다.
- API Base URL은 `EXPO_PUBLIC_API_BASE_URL`(`.env.local`), 개발용 로그인 ID는 `EXPO_PUBLIC_DEV_LOGIN_ID`(없으면 `dev-user`). 비밀값을 넣지 않는다.
- 개발 모드(`__DEV__`)에서만 credential `ok:<개발용 ID>`를 보낸다. 개발 모드가 아니면 "아직 준비 중인 로그인이에요."
- 단계 계산: `GET /users/me`의 `petType`이 `null`이면 `pet`(예산을 조회하지 않음), 아니면 `GET /months/{현재월}/budget`의 `amount`가 `null`이면 `budget`, 아니면 `ready`.
- 월은 `Asia/Seoul` 기준 `YYYY-MM`. 예산은 1 ~ 100,000,000 원화 정수.
- 사용률은 API `usagePercent`를 그대로 쓰고 소수부가 0이면 `.0`을 숨긴다. 펫 상태는 서버 `petState`를 따르고 앱에서 다시 판정하지 않는다.
- 알려진 오류 코드는 앱 문구, 입력 오류(400 `fields`)만 서버 메시지를 쓴다.
- 라우트 파일만 `src/app/`에 둔다. 테스트는 `__tests__/`에 둔다.
- 코드 작성 시 `.agents/skills/karpathy-guidelines/SKILL.md`를 적용한다. Expo API는 SDK 58 문서를 확인한 뒤 쓴다.
- 커밋은 Conventional Commits, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- 저장·로그인 버튼을 빠르게 두 번 누름 → 요청은 한 번만 가야 한다(Task 9 테스트).
- 직전 달 예산 응답이 사용자가 이미 입력한 뒤에 도착 → 사용자 입력을 덮어쓰면 안 된다(Task 9 테스트).
- 토큰 갱신이 401이 아닌 네트워크 오류로 실패 → 로그아웃하거나 저장 토큰을 지우면 안 된다(Task 4 테스트).
- 저장된 토큰으로 시작했는데 `/users/me`가 네트워크 오류 → 로그인 화면이 아니라 "다시 시도" 오류 상태, 토큰 유지(Task 6 테스트).
- 예산 입력에 앞자리 0·숫자가 아닌 문자·10자리 이상 → 정리된 값과 범위 오류(Task 2 테스트).

---

### Task 1: 서울 기준 월 계산

**Files:**
- Create: `src/lib/month.ts`
- Test: `__tests__/month-test.ts`

**Interfaces:**
- Produces: `currentMonth(now?: Date): string`, `previousMonth(month: string): string`, `monthTitle(month: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/month-test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/month-test.ts`
Expected: FAIL with "Cannot find module '@/lib/month'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/month.ts
// Asia/Seoul is UTC+9 with no daylight saving time.
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

function toMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function currentMonth(now: Date = new Date()): string {
  const seoul = new Date(now.getTime() + SEOUL_OFFSET_MS);
  return toMonth(seoul.getUTCFullYear(), seoul.getUTCMonth() + 1);
}

export function previousMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? toMonth(year - 1, 12) : toMonth(year, m - 1);
}

export function monthTitle(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year}년 ${m}월`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/month-test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/month.ts __tests__/month-test.ts
git commit -m "feat: add Seoul-based month helpers"
```

---

### Task 2: 금액 입력·표시

**Files:**
- Create: `src/lib/money.ts`
- Test: `__tests__/money-test.ts`

**Interfaces:**
- Produces:
  - `formatWon(amount: number): string` — `135000` → `"135,000원"`
  - `formatBudgetInput(text: string): string` — 숫자만 남기고 앞자리 0 제거, 최대 10자리, 쉼표 표시
  - `type BudgetInput = { ok: true; amount: number } | { ok: false; error: string }`
  - `parseBudgetInput(text: string): BudgetInput`
  - `formatUsagePercent(percent: number): string`
  - `describeBalance(balance: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/money-test.ts
import {
  describeBalance,
  formatBudgetInput,
  formatUsagePercent,
  formatWon,
  parseBudgetInput,
} from '@/lib/money';

describe('formatWon', () => {
  test('adds thousands separators and 원', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(1234567)).toBe('1,234,567원');
  });
});

describe('formatBudgetInput', () => {
  test('keeps digits only and adds separators', () => {
    expect(formatBudgetInput('12a3,4')).toBe('1,234');
  });

  test('drops leading zeros but keeps a single 0', () => {
    expect(formatBudgetInput('00012')).toBe('12');
    expect(formatBudgetInput('0')).toBe('0');
  });

  test('caps the length at 10 digits', () => {
    expect(formatBudgetInput('123456789012')).toBe('1,234,567,890');
  });

  test('returns empty for no digits', () => {
    expect(formatBudgetInput('abc')).toBe('');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/money-test.ts`
Expected: FAIL with "Cannot find module '@/lib/money'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/money.ts
const BUDGET_MIN = 1;
const BUDGET_MAX = 100_000_000;

function formatNumber(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatWon(amount: number): string {
  return `${formatNumber(amount)}원`;
}

export function formatBudgetInput(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
  return digits === '' ? '' : formatNumber(Number(digits));
}

export type BudgetInput = { ok: true; amount: number } | { ok: false; error: string };

export function parseBudgetInput(text: string): BudgetInput {
  const digits = text.replace(/,/g, '');
  if (digits === '') return { ok: false, error: '예산을 입력해 주세요' };
  if (!/^\d+$/.test(digits)) return { ok: false, error: '숫자만 입력할 수 있어요' };
  const amount = Number(digits);
  if (amount < BUDGET_MIN || amount > BUDGET_MAX) {
    return { ok: false, error: '1원부터 1억 원까지 입력할 수 있어요' };
  }
  return { ok: true, amount };
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/money-test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts __tests__/money-test.ts
git commit -m "feat: add budget input parsing and money display helpers"
```

---

### Task 3: 온보딩 단계 판정

**Files:**
- Create: `src/lib/onboarding-stage.ts`
- Test: `__tests__/onboarding-stage-test.ts`

**Interfaces:**
- Consumes: `PetType` from `src/api/types.ts` (Task 4). 이 Task에서는 타입만 쓰므로 Task 4보다 먼저 하려면 Step 3에서 `src/api/types.ts`를 Task 4 Step 3의 내용 그대로 먼저 만든다.
- Produces: `type Stage = 'pet' | 'budget' | 'ready'`, `resolveStage(petType: PetType | null, budgetAmount: number | null): Stage`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/onboarding-stage-test.ts
import { resolveStage } from '@/lib/onboarding-stage';

describe('resolveStage', () => {
  test('asks for a pet first when nothing is set', () => {
    expect(resolveStage(null, null)).toBe('pet');
  });

  test('asks for a pet even if a budget exists', () => {
    expect(resolveStage(null, 300000)).toBe('pet');
  });

  test('asks for a budget once the pet is chosen', () => {
    expect(resolveStage('CAT', null)).toBe('budget');
  });

  test('is ready when both are set', () => {
    expect(resolveStage('DOG', 300000)).toBe('ready');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/onboarding-stage-test.ts`
Expected: FAIL with "Cannot find module '@/lib/onboarding-stage'"

- [ ] **Step 3: Write minimal implementation**

Task 4를 아직 하지 않았다면 `src/api/types.ts`를 Task 4 Step 3의 내용으로 먼저 만든다.

```ts
// src/lib/onboarding-stage.ts
import type { PetType } from '@/api/types';

export type Stage = 'pet' | 'budget' | 'ready';

export function resolveStage(petType: PetType | null, budgetAmount: number | null): Stage {
  if (petType === null) return 'pet';
  if (budgetAmount === null) return 'budget';
  return 'ready';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/onboarding-stage-test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding-stage.ts __tests__/onboarding-stage-test.ts src/api/types.ts
git commit -m "feat: add onboarding stage resolution"
```

---

### Task 4: API 클라이언트

**Files:**
- Create: `src/api/types.ts` (Task 3에서 만들었으면 그대로 둔다), `src/api/client.ts`
- Test: `__tests__/api-client-test.ts`

**Interfaces:**
- Produces:
  - `src/api/types.ts`: `Provider`, `PetType`, `PetState`, `TokenResponse`, `Me`, `Budget`, `Home`, `FieldError`, `ErrorBody`
  - `class ApiError extends Error { status: number; code: string; fields: FieldError[]; fieldMessage(field: string): string | undefined }`
  - `type TokenStore = { getRefreshToken(): Promise<string | null>; setRefreshToken(token: string): Promise<void>; clear(): Promise<void> }`
  - `createApiClient({ baseUrl, tokenStore, onSessionExpired }): ApiClient`
  - `ApiClient`: `login(provider, credential): Promise<void>`, `restoreSession(): Promise<boolean>`, `getMe(): Promise<Me>`, `putPet(petType): Promise<Me>`, `getBudget(month): Promise<Budget>`, `putBudget(month, amount): Promise<Budget>`, `getHome(): Promise<Home>`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api-client-test.ts
import { ApiError, createApiClient, type TokenStore } from '@/api/client';

type Handler = (url: string, init: RequestInit) => Promise<Response> | Response;

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function memoryStore(initial: string | null = null) {
  let token = initial;
  return {
    getRefreshToken: jest.fn(async () => token),
    setRefreshToken: jest.fn(async (next: string) => {
      token = next;
    }),
    clear: jest.fn(async () => {
      token = null;
    }),
    peek: () => token,
  } satisfies TokenStore & { peek: () => string | null };
}

const BASE = 'http://api.test/api/v1';
let handler: Handler;
const fetchMock = jest.fn((url: string, init: RequestInit) => Promise.resolve(handler(url, init)));

beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

function bearer(init: RequestInit): string | undefined {
  return (init.headers as Record<string, string>).Authorization;
}

function setup(initialRefresh: string | null = null) {
  const store = memoryStore(initialRefresh);
  const onSessionExpired = jest.fn();
  const api = createApiClient({ baseUrl: BASE, tokenStore: store, onSessionExpired });
  return { api, store, onSessionExpired };
}

const ME = { id: 1, provider: 'KAKAO', petType: null };

test('sends the login access token as a Bearer header and stores the refresh token', async () => {
  handler = (url, init) => {
    if (url === `${BASE}/auth/login/kakao`) {
      expect(JSON.parse(init.body as string)).toEqual({ credential: 'ok:dev' });
      return jsonResponse(200, { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 });
    }
    expect(bearer(init)).toBe('Bearer a1');
    return jsonResponse(200, ME);
  };
  const { api, store } = setup();

  await api.login('kakao', 'ok:dev');
  await expect(api.getMe()).resolves.toEqual(ME);
  expect(store.peek()).toBe('r1');
});

test('turns an error body into ApiError with code and field messages', async () => {
  handler = () =>
    jsonResponse(400, {
      code: 'INVALID_REQUEST',
      message: '입력 오류',
      fields: [{ field: 'amount', message: '금액을 확인해 주세요' }],
    });
  const { api } = setup();

  const error = await api.putBudget('2026-10', 0).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 400, code: 'INVALID_REQUEST' });
  expect((error as ApiError).fieldMessage('amount')).toBe('금액을 확인해 주세요');
});

test('refreshes after a 401 and retries the request once', async () => {
  handler = (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'r0' });
      return jsonResponse(200, { accessToken: 'a2', refreshToken: 'r2', accessExpiresInSeconds: 900 });
    }
    return bearer(init) === 'Bearer a2' ? jsonResponse(200, ME) : jsonResponse(401, { code: 'UNAUTHORIZED' });
  };
  const { api, store } = setup('r0');

  await expect(api.getMe()).resolves.toEqual(ME);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(store.peek()).toBe('r2');
});

test('shares one refresh across concurrent 401 responses', async () => {
  let refreshCalls = 0;
  handler = async (url, init) => {
    if (url.endsWith('/auth/refresh')) {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return jsonResponse(200, { accessToken: 'a2', refreshToken: 'r2', accessExpiresInSeconds: 900 });
    }
    return bearer(init) === 'Bearer a2' ? jsonResponse(200, ME) : jsonResponse(401, { code: 'UNAUTHORIZED' });
  };
  const { api } = setup('r0');

  await expect(Promise.all([api.getMe(), api.getMe(), api.getMe()])).resolves.toHaveLength(3);
  expect(refreshCalls).toBe(1);
});

test('expires the session when the refresh token is rejected', async () => {
  handler = () => jsonResponse(401, { code: 'UNAUTHORIZED' });
  const { api, store, onSessionExpired } = setup('r0');

  const error = await api.getMe().catch((e: unknown) => e);
  expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  expect(store.clear).toHaveBeenCalled();
  expect(onSessionExpired).toHaveBeenCalledTimes(1);
});

test('restoreSession reports false without a stored refresh token', async () => {
  handler = () => {
    throw new Error('should not call the server');
  };
  const { api } = setup(null);

  await expect(api.restoreSession()).resolves.toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('keeps the session when refresh fails with a network error', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) throw new TypeError('Network request failed');
    return jsonResponse(401, { code: 'UNAUTHORIZED' });
  };
  const { api, store, onSessionExpired } = setup('r0');

  await expect(api.getMe()).rejects.toThrow('Network request failed');
  expect(store.clear).not.toHaveBeenCalled();
  expect(onSessionExpired).not.toHaveBeenCalled();
  expect(store.peek()).toBe('r0');
});

test('never puts tokens into error messages', async () => {
  handler = (url) =>
    url.endsWith('/auth/login/google')
      ? jsonResponse(200, { accessToken: 'secret-access', refreshToken: 'secret-refresh', accessExpiresInSeconds: 900 })
      : jsonResponse(500, { code: 'INTERNAL_ERROR', message: '서버 오류' });
  const { api } = setup();

  await api.login('google', 'ok:dev');
  const error = (await api.getHome().catch((e: unknown) => e)) as Error;
  expect(String(error)).not.toMatch(/secret/);
  expect(error.message).not.toMatch(/secret/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/api-client-test.ts`
Expected: FAIL with "Cannot find module '@/api/client'"

- [ ] **Step 3: Write minimal implementation**

```ts
// src/api/types.ts
// Response shapes from docs/api-spec.md.
export type Provider = 'kakao' | 'google';
export type PetType = 'CAT' | 'DOG';
export type PetState = 'STABLE' | 'CAUTION' | 'WARNING' | 'BUDGET_REACHED';

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
};

export type Me = { id: number; provider: 'KAKAO' | 'GOOGLE'; petType: PetType | null };

export type Budget = { month: string; amount: number | null };

export type Home = {
  month: string;
  petType: PetType;
  petState: PetState;
  budgetAmount: number;
  spentAmount: number;
  usagePercent: number;
  budgetBalanceAmount: number;
};

export type FieldError = { field: string; message: string };

export type ErrorBody = { code: string; message: string; fields?: FieldError[] };
```

```ts
// src/api/client.ts
import type { Budget, ErrorBody, FieldError, Home, Me, PetType, Provider, TokenResponse } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: FieldError[] = [],
  ) {
    super(`API error ${status} ${code}`);
    this.name = 'ApiError';
  }

  fieldMessage(field: string): string | undefined {
    return this.fields.find((f) => f.field === field)?.message;
  }
}

export type TokenStore = {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clear(): Promise<void>;
};

type ApiClientOptions = {
  baseUrl: string;
  tokenStore: TokenStore;
  onSessionExpired: () => void;
};

type Method = 'GET' | 'POST' | 'PUT';

async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ErrorBody;
    return new ApiError(res.status, body.code, body.fields ?? []);
  } catch {
    return new ApiError(res.status, 'UNKNOWN');
  }
}

export type ApiClient = ReturnType<typeof createApiClient>;

export function createApiClient({ baseUrl, tokenStore, onSessionExpired }: ApiClientOptions) {
  // The access token lives only in memory; the refresh token is persisted by tokenStore.
  let accessToken: string | null = null;
  let refreshing: Promise<boolean> | null = null;

  function send(method: Method, path: string, body?: unknown, auth = true) {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async function saveTokens(res: Response) {
    const tokens = (await res.json()) as TokenResponse;
    accessToken = tokens.accessToken;
    await tokenStore.setRefreshToken(tokens.refreshToken);
  }

  async function expire() {
    accessToken = null;
    await tokenStore.clear();
    onSessionExpired();
  }

  // A refresh token works only once, so concurrent callers share one in-flight refresh.
  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) return false;
        const res = await send('POST', '/auth/refresh', { refreshToken }, false);
        if (res.status === 401) {
          await expire();
          return false;
        }
        if (!res.ok) throw await toApiError(res);
        await saveTokens(res);
        return true;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
    let res = await send(method, path, body);
    if (res.status === 401) {
      if (!(await refresh())) throw new ApiError(401, 'UNAUTHORIZED');
      res = await send(method, path, body);
    }
    if (!res.ok) throw await toApiError(res);
    return (await res.json()) as T;
  }

  return {
    async login(provider: Provider, credential: string) {
      const res = await send('POST', `/auth/login/${provider}`, { credential }, false);
      if (!res.ok) throw await toApiError(res);
      await saveTokens(res);
    },
    restoreSession: refresh,
    getMe: () => request<Me>('GET', '/users/me'),
    putPet: (petType: PetType) => request<Me>('PUT', '/users/me/pet', { petType }),
    getBudget: (month: string) => request<Budget>('GET', `/months/${month}/budget`),
    putBudget: (month: string, amount: number) =>
      request<Budget>('PUT', `/months/${month}/budget`, { amount }),
    getHome: () => request<Home>('GET', '/home'),
  };
}
```

`refresh()`에 저장 토큰이 없으면 `false`만 반환한다. 이때 401을 받은 `request`는 `ApiError(401)`을 던지고, 세션 상태 전환은 Task 6의 `SessionProvider`가 401을 보고 처리한다. 저장 토큰이 없는데 인증 요청을 보내는 경로는 로그인 전에는 없다.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/api-client-test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts src/api/client.ts __tests__/api-client-test.ts
git commit -m "feat: add API client with single-flight token refresh"
```

---

### Task 5: 설정·토큰 저장소·개발용 credential·오류 문구

**Files:**
- Create: `src/config.ts`, `src/session/token-store.ts`, `src/session/social-credential.ts`, `src/lib/error-message.ts`, `.env.example`
- Modify: `package.json`, `package-lock.json` (`expo-secure-store` 추가)
- Test: `__tests__/social-credential-test.ts`, `__tests__/error-message-test.ts`

**Interfaces:**
- Consumes: `Provider` (Task 4), `ApiError`, `TokenStore` (Task 4)
- Produces:
  - `apiBaseUrl: string | null`, `devLoginId: string`
  - `secureTokenStore: TokenStore`
  - `class SocialLoginNotReadyError extends Error`, `getSocialCredential(provider: Provider, isDev?: boolean): Promise<string>`
  - `CONNECTION_ERROR: string`, `errorMessage(error: unknown): string`

- [ ] **Step 1: Install the dependency**

Run: `npx expo install expo-secure-store`
Expected: `package.json` dependencies에 `expo-secure-store`(~58.x)가 추가된다.

- [ ] **Step 2: Write the failing tests**

```ts
// __tests__/social-credential-test.ts
import { getSocialCredential, SocialLoginNotReadyError } from '@/session/social-credential';

test('returns the bootTestRun fake credential in development', async () => {
  await expect(getSocialCredential('kakao', true)).resolves.toMatch(/^ok:.+/);
});

test('refuses outside development until the SDKs are wired', async () => {
  await expect(getSocialCredential('google', false)).rejects.toBeInstanceOf(SocialLoginNotReadyError);
});
```

```ts
// __tests__/error-message-test.ts
import { ApiError } from '@/api/client';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { SocialLoginNotReadyError } from '@/session/social-credential';

test('maps social login errors to app copy', () => {
  expect(errorMessage(new ApiError(401, 'SOCIAL_LOGIN_FAILED'))).toBe('로그인에 실패했어요. 다시 시도해 주세요.');
  expect(errorMessage(new ApiError(503, 'SOCIAL_LOGIN_UNAVAILABLE'))).toBe(
    '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.',
  );
  expect(errorMessage(new SocialLoginNotReadyError('kakao'))).toBe('아직 준비 중인 로그인이에요.');
});

test('falls back to the connection message for network and server errors', () => {
  expect(errorMessage(new TypeError('Network request failed'))).toBe(CONNECTION_ERROR);
  expect(errorMessage(new ApiError(500, 'INTERNAL_ERROR'))).toBe(CONNECTION_ERROR);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/social-credential-test.ts __tests__/error-message-test.ts`
Expected: FAIL with "Cannot find module '@/session/social-credential'"

- [ ] **Step 4: Write minimal implementation**

```ts
// src/config.ts
// EXPO_PUBLIC_* values are inlined into the app bundle; never put secrets here.
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || null;
export const devLoginId = process.env.EXPO_PUBLIC_DEV_LOGIN_ID || 'dev-user';
```

```ts
// src/session/token-store.ts
import * as SecureStore from 'expo-secure-store';

import type { TokenStore } from '@/api/client';

const REFRESH_TOKEN_KEY = 'petgyebu.refreshToken';

export const secureTokenStore: TokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
```

```ts
// src/session/social-credential.ts
import type { Provider } from '@/api/types';
import { devLoginId } from '@/config';

export class SocialLoginNotReadyError extends Error {
  constructor(provider: Provider) {
    super(`${provider} login is not available yet`);
    this.name = 'SocialLoginNotReadyError';
  }
}

// Until the Kakao/Google SDKs are wired, development builds use the
// backend bootTestRun fake verifier, which accepts `ok:<id>`.
export async function getSocialCredential(provider: Provider, isDev: boolean = __DEV__): Promise<string> {
  if (!isDev) throw new SocialLoginNotReadyError(provider);
  return `ok:${devLoginId}`;
}
```

```ts
// src/lib/error-message.ts
import { ApiError } from '@/api/client';
import { SocialLoginNotReadyError } from '@/session/social-credential';

export const CONNECTION_ERROR = '서버에 연결할 수 없어요. 다시 시도해 주세요.';

export function errorMessage(error: unknown): string {
  if (error instanceof SocialLoginNotReadyError) return '아직 준비 중인 로그인이에요.';
  if (error instanceof ApiError) {
    if (error.code === 'SOCIAL_LOGIN_FAILED') return '로그인에 실패했어요. 다시 시도해 주세요.';
    if (error.code === 'SOCIAL_LOGIN_UNAVAILABLE') {
      return '지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.';
    }
  }
  return CONNECTION_ERROR;
}
```

```bash
# .env.example
# Copy to .env.local (gitignored). Values are bundled into the app, so never put secrets here.
# iOS simulator: http://localhost:8080/api/v1 · Android emulator: http://10.0.2.2:8080/api/v1
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
EXPO_PUBLIC_DEV_LOGIN_ID=dev-user
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/social-credential-test.ts __tests__/error-message-test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: exit 0. `__DEV__`·`process.env` 타입은 `expo-env.d.ts`(expo/types)에서 온다. 실패하면 `npx expo start`를 한 번 실행해 `expo-env.d.ts`를 만든 뒤 다시 실행한다.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/config.ts src/session/token-store.ts \
  src/session/social-credential.ts src/lib/error-message.ts \
  __tests__/social-credential-test.ts __tests__/error-message-test.ts
git commit -m "feat: add config, secure token store, dev credential, and error copy"
```

---

### Task 6: SessionProvider

**Files:**
- Create: `src/session/session-provider.tsx`
- Test: `__tests__/session-provider-test.tsx`

**Interfaces:**
- Consumes: `createApiClient`, `ApiClient`, `ApiError`, `TokenStore` (Task 4); `secureTokenStore`, `getSocialCredential` (Task 5); `resolveStage`, `Stage` (Task 3); `currentMonth` (Task 1)
- Produces:
  - `type SessionState = { status: 'loading' } | { status: 'error' } | { status: 'signedOut' } | { status: 'signedIn'; stage: Stage }`
  - `SessionProvider({ baseUrl: string; tokenStore?: TokenStore; children })`
  - `useSession(): { state: SessionState; api: ApiClient; signIn(provider: Provider): Promise<void>; refreshStage(): Promise<void>; retry(): void }`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/session-provider-test.tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { TokenStore } from '@/api/client';
import { SessionProvider, useSession } from '@/session/session-provider';

jest.mock('expo-secure-store', () => ({}));

type Handler = (url: string) => Response | Promise<Response>;

function jsonResponse(status: number, body?: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

let handler: Handler;
beforeEach(() => {
  global.fetch = jest.fn((url: string) => Promise.resolve(handler(url))) as unknown as typeof fetch;
});

function storeWith(token: string | null) {
  return {
    getRefreshToken: jest.fn(async () => token),
    setRefreshToken: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } satisfies TokenStore;
}

function Probe() {
  const { state } = useSession();
  return <Text>{state.status === 'signedIn' ? `signedIn:${state.stage}` : state.status}</Text>;
}

async function renderSession(store: TokenStore) {
  await render(
    <SessionProvider baseUrl="http://api.test/api/v1" tokenStore={store}>
      <Probe />
    </SessionProvider>,
  );
}

const TOKENS = { accessToken: 'a1', refreshToken: 'r1', accessExpiresInSeconds: 900 };

test('is signed out without a stored refresh token', async () => {
  handler = () => {
    throw new Error('should not call the server');
  };
  await renderSession(storeWith(null));

  await screen.findByText('signedOut');
});

test('goes to the pet stage without asking for the budget', async () => {
  const urls: string[] = [];
  handler = (url) => {
    urls.push(url);
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: null });
  };
  await renderSession(storeWith('r0'));

  await screen.findByText('signedIn:pet');
  expect(urls.some((u) => u.includes('/budget'))).toBe(false);
});

test('goes to the budget stage when the current month has no budget', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    if (url.endsWith('/users/me')) return jsonResponse(200, { id: 1, provider: 'KAKAO', petType: 'CAT' });
    return jsonResponse(200, { month: '2026-10', amount: null });
  };
  await renderSession(storeWith('r0'));

  await screen.findByText('signedIn:budget');
});

test('signs out and clears the token when the refresh token is rejected', async () => {
  handler = () => jsonResponse(401, { code: 'UNAUTHORIZED' });
  const store = storeWith('r0');
  await renderSession(store);

  await screen.findByText('signedOut');
  expect(store.clear).toHaveBeenCalled();
});

test('shows an error and keeps the token when the server is unreachable', async () => {
  handler = (url) => {
    if (url.endsWith('/auth/refresh')) return jsonResponse(200, TOKENS);
    throw new TypeError('Network request failed');
  };
  const store = storeWith('r0');
  await renderSession(store);

  await screen.findByText('error');
  expect(store.clear).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/session-provider-test.tsx`
Expected: FAIL with "Cannot find module '@/session/session-provider'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/session/session-provider.tsx
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import { ApiError, createApiClient, type ApiClient, type TokenStore } from '@/api/client';
import type { Provider } from '@/api/types';
import { currentMonth } from '@/lib/month';
import { resolveStage, type Stage } from '@/lib/onboarding-stage';

import { getSocialCredential } from './social-credential';
import { secureTokenStore } from './token-store';

export type SessionState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; stage: Stage };

type SessionContextValue = {
  state: SessionState;
  api: ApiClient;
  signIn: (provider: Provider) => Promise<void>;
  refreshStage: () => Promise<void>;
  retry: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = use(SessionContext);
  if (!value) throw new Error('useSession must be used inside <SessionProvider>');
  return value;
}

async function loadStage(api: ApiClient): Promise<Stage> {
  const me = await api.getMe();
  if (me.petType === null) return resolveStage(null, null);
  const budget = await api.getBudget(currentMonth());
  return resolveStage(me.petType, budget.amount);
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

type SessionProviderProps = PropsWithChildren<{ baseUrl: string; tokenStore?: TokenStore }>;

export function SessionProvider({ baseUrl, tokenStore = secureTokenStore, children }: SessionProviderProps) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const [api] = useState(() =>
    createApiClient({ baseUrl, tokenStore, onSessionExpired: () => setState({ status: 'signedOut' }) }),
  );
  const [bootAttempt, setBootAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const restored = await api.restoreSession();
        const next: SessionState = restored ? { status: 'signedIn', stage: await loadStage(api) } : { status: 'signedOut' };
        if (active) setState(next);
      } catch (error) {
        if (active) setState(isUnauthorized(error) ? { status: 'signedOut' } : { status: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [api, bootAttempt]);

  const signIn = useCallback(
    async (provider: Provider) => {
      const credential = await getSocialCredential(provider);
      await api.login(provider, credential);
      setState({ status: 'signedIn', stage: await loadStage(api) });
    },
    [api],
  );

  const refreshStage = useCallback(async () => {
    setState({ status: 'signedIn', stage: await loadStage(api) });
  }, [api]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setBootAttempt((n) => n + 1);
  }, []);

  return <SessionContext value={{ state, api, signIn, refreshStage, retry }}>{children}</SessionContext>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/session-provider-test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: exit 0. `react-hooks` 규칙이 effect 안의 setState를 지적하면 규칙을 끄지 말고, setState가 `await` 뒤 비동기 콜백 안에서만 일어나도록 코드를 고친다.

- [ ] **Step 6: Commit**

```bash
git add src/session/session-provider.tsx __tests__/session-provider-test.tsx
git commit -m "feat: add session provider with token restore and onboarding stage"
```

---

### Task 7: 공통 컴포넌트, 루트 레이아웃, 로그인 화면

**Files:**
- Create: `src/components/button.tsx`, `src/components/message-view.tsx`, `src/app/sign-in.tsx`
- Modify: `src/app/_layout.tsx` (전체 교체)

**Interfaces:**
- Consumes: `apiBaseUrl` (Task 5), `SessionProvider`, `useSession` (Task 6), `errorMessage`, `CONNECTION_ERROR` (Task 5), `Provider` (Task 4)
- Produces:
  - `Button({ label: string; onPress: () => void; disabled?: boolean; loading?: boolean })` — `accessibilityRole="button"`, `accessibilityLabel={label}`
  - `MessageView({ message: string; actionLabel?: string; onAction?: () => void })`, `LoadingView()`

- [ ] **Step 1: Write the shared components**

```tsx
// src/components/button.tsx
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function Button({ label, onPress, disabled = false, loading = false }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, inactive && styles.inactive, pressed && styles.pressed]}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#208AEF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  label: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
```

```tsx
// src/components/message-view.tsx
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './button';

type MessageViewProps = { message: string; actionLabel?: string; onAction?: () => void };

export function MessageView({ message, actionLabel, onAction }: MessageViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} />}
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={styles.container}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: '#fff' },
  message: { fontSize: 16, textAlign: 'center', color: '#111' },
});
```

- [ ] **Step 2: Replace the root layout**

```tsx
// src/app/_layout.tsx
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

import { LoadingView, MessageView } from '@/components/message-view';
import { apiBaseUrl } from '@/config';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { SessionProvider, useSession } from '@/session/session-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  if (!apiBaseUrl) {
    SplashScreen.hide();
    return <MessageView message="API 주소(EXPO_PUBLIC_API_BASE_URL)가 설정되지 않았어요. .env.local을 확인해 주세요." />;
  }
  return (
    <SessionProvider baseUrl={apiBaseUrl}>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { state, retry } = useSession();

  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hide();
  }, [state.status]);

  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;

  const stage = state.status === 'signedIn' ? state.stage : null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'pet'}>
        <Stack.Screen name="pet" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'budget'}>
        <Stack.Screen name="budget" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'ready'}>
        <Stack.Screen name="index" />
      </Stack.Protected>
    </Stack>
  );
}
```

- [ ] **Step 3: Write the sign-in screen**

```tsx
// src/app/sign-in.tsx
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Provider } from '@/api/types';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { useSession } from '@/session/session-provider';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePress(provider: Provider) {
    setPending(provider);
    setError(null);
    try {
      await signIn(provider);
    } catch (e) {
      setError(errorMessage(e));
      setPending(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>펫계부</Text>
        <Text style={styles.subtitle}>펫과 함께 예산을 지켜요</Text>
      </View>
      <View style={styles.actions}>
        <Button
          label="카카오로 시작하기"
          onPress={() => handlePress('kakao')}
          loading={pending === 'kakao'}
          disabled={pending !== null}
        />
        <Button
          label="구글로 시작하기"
          onPress={() => handlePress('google')}
          loading={pending === 'google'}
          disabled={pending !== null}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: 24, backgroundColor: '#fff' },
  header: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 16, color: '#555' },
  actions: { gap: 12 },
  error: { color: '#D93025', textAlign: 'center' },
});
```

- [ ] **Step 4: Run checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 모두 exit 0. 기존 `__tests__/index-screen-test.tsx`는 아직 예전 `index.tsx`를 렌더하므로 통과한다(Task 10에서 교체).

- [ ] **Step 5: Commit**

```bash
git add src/components/button.tsx src/components/message-view.tsx src/app/_layout.tsx src/app/sign-in.tsx
git commit -m "feat: add root session layout and sign-in screen"
```

---

### Task 8: 펫 선택 화면

**Files:**
- Create: `src/lib/pet.ts`, `src/app/pet.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 6), `Button` (Task 7), `errorMessage` (Task 5), `PetType`, `PetState` (Task 4)
- Produces: `PET_LABELS: Record<PetType, string>`, `PET_STATE_COPY: Record<PetState, { name: string; description: string }>`

- [ ] **Step 1: Write pet copy**

```ts
// src/lib/pet.ts
import type { PetState, PetType } from '@/api/types';

export const PET_LABELS: Record<PetType, string> = { CAT: '고양이', DOG: '강아지' };

// Avoid blame, illness, or punishment wording (docs/00 §4).
export const PET_STATE_COPY: Record<PetState, { name: string; description: string }> = {
  STABLE: { name: '안정', description: '편안하게 지내고 있어요' },
  CAUTION: { name: '주의', description: '남은 예산을 눈여겨보고 있어요' },
  WARNING: { name: '경고', description: '남은 예산이 신경 쓰이는 눈치예요' },
  BUDGET_REACHED: { name: '예산 도달', description: '예산을 모두 사용했어요' },
};
```

- [ ] **Step 2: Write the pet screen**

```tsx
// src/app/pet.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PetType } from '@/api/types';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { PET_LABELS } from '@/lib/pet';
import { useSession } from '@/session/session-provider';

const PET_TYPES: PetType[] = ['CAT', 'DOG'];

export default function PetScreen() {
  const { api, refreshStage } = useSession();
  const [selected, setSelected] = useState<PetType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api.putPet(selected);
      await refreshStage();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>함께할 펫을 골라 주세요</Text>
      <View style={styles.cards}>
        {PET_TYPES.map((type) => (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === type }}
            onPress={() => setSelected(type)}
            style={[styles.card, selected === type && styles.cardSelected]}>
            <Text style={styles.cardLabel}>{PET_LABELS[type]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="다음" onPress={save} disabled={!selected} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 24 },
  cards: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSelected: { borderColor: '#208AEF', backgroundColor: '#EAF4FE' },
  cardLabel: { fontSize: 20, fontWeight: '600', color: '#111' },
  footer: { marginTop: 'auto', gap: 12 },
  error: { color: '#D93025', textAlign: 'center' },
});
```

- [ ] **Step 3: Run checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 모두 exit 0

- [ ] **Step 4: Commit**

```bash
git add src/lib/pet.ts src/app/pet.tsx
git commit -m "feat: add pet selection screen"
```

---

### Task 9: 예산 설정 화면

**Files:**
- Create: `src/app/budget.tsx`
- Test: `__tests__/budget-screen-test.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 6), `ApiError` (Task 4), `currentMonth`, `previousMonth`, `monthTitle` (Task 1), `formatBudgetInput`, `parseBudgetInput` (Task 2), `errorMessage` (Task 5), `Button` (Task 7)
- Produces: 기본 export `BudgetScreen`. 입력란 `accessibilityLabel="예산 금액"`, 저장 버튼 이름 `저장`.

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/budget-screen-test.tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import BudgetScreen from '@/app/budget';

const mockApi = { getBudget: jest.fn(), putBudget: jest.fn() };
const mockRefreshStage = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshStage.mockResolvedValue(undefined);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('prefills the previous month budget without saving it', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: 250000 });
  await render(<BudgetScreen />);

  await screen.findByText('지난달 예산을 불러왔어요');
  expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('250,000');
  expect(mockApi.putBudget).not.toHaveBeenCalled();
});

test('does not overwrite what the user typed with a late suggestion', async () => {
  const suggestion = deferred<{ month: string; amount: number }>();
  mockApi.getBudget.mockReturnValue(suggestion.promise);
  await render(<BudgetScreen />);

  await fireEvent.changeText(screen.getByLabelText('예산 금액'), '50000');
  suggestion.resolve({ month: '2026-09', amount: 250000 });

  await screen.findByDisplayValue('50,000');
  expect(screen.queryByText('지난달 예산을 불러왔어요')).toBeNull();
});

test('disables saving for amounts outside 1 to 100,000,000', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: null });
  await render(<BudgetScreen />);
  const input = screen.getByLabelText('예산 금액');

  await fireEvent.changeText(input, '0');
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  screen.getByText('1원부터 1억 원까지 입력할 수 있어요');

  await fireEvent.changeText(input, '100000001');
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('shows the server amount error and keeps the input', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: null });
  mockApi.putBudget.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'amount', message: '금액을 확인해 주세요' }]),
  );
  await render(<BudgetScreen />);

  await fireEvent.changeText(screen.getByLabelText('예산 금액'), '300000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('금액을 확인해 주세요');
  expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('300,000');
  expect(mockRefreshStage).not.toHaveBeenCalled();
});

test('sends one request when save is pressed twice', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: null });
  mockApi.putBudget.mockReturnValue(new Promise(() => {}));
  await render(<BudgetScreen />);

  await fireEvent.changeText(screen.getByLabelText('예산 금액'), '300000');
  const save = screen.getByRole('button', { name: '저장' });
  await fireEvent.press(save);
  await fireEvent.press(save);

  expect(mockApi.putBudget).toHaveBeenCalledTimes(1);
  expect(mockApi.putBudget).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), 300000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/budget-screen-test.tsx`
Expected: FAIL with "Cannot find module '@/app/budget'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/budget.tsx
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { formatBudgetInput, parseBudgetInput } from '@/lib/money';
import { currentMonth, monthTitle, previousMonth } from '@/lib/month';
import { useSession } from '@/session/session-provider';

export default function BudgetScreen() {
  const { api, refreshStage } = useSession();
  const month = currentMonth();
  const [text, setText] = useState('');
  const [suggested, setSuggested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const touched = useRef(false);

  // Suggest last month's budget; never save it until the user does.
  useEffect(() => {
    let active = true;
    api.getBudget(previousMonth(month)).then(
      (budget) => {
        if (!active || touched.current || budget.amount === null) return;
        setText(formatBudgetInput(String(budget.amount)));
        setSuggested(true);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [api, month]);

  const parsed = parseBudgetInput(text);

  function handleChange(value: string) {
    touched.current = true;
    setText(formatBudgetInput(value));
    setSuggested(false);
    setServerError(null);
  }

  async function save() {
    if (!parsed.ok || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      await api.putBudget(month, parsed.amount);
      await refreshStage();
    } catch (e) {
      if (e instanceof ApiError && e.fieldMessage('month')) {
        // The month changed while this screen was open; re-check the stage for the new month.
        await refreshStage().catch(() => {});
      } else {
        setServerError((e instanceof ApiError && e.fieldMessage('amount')) || errorMessage(e));
      }
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{monthTitle(month)} 예산</Text>
      <View style={styles.field}>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="예산 금액"
            keyboardType="number-pad"
            value={text}
            onChangeText={handleChange}
            placeholder="0"
            style={styles.input}
          />
          <Text style={styles.unit}>원</Text>
        </View>
        {suggested && <Text style={styles.hint}>지난달 예산을 불러왔어요</Text>}
        {!parsed.ok && <Text style={styles.hint}>{parsed.error}</Text>}
        {serverError && <Text style={styles.error}>{serverError}</Text>}
      </View>
      <View style={styles.footer}>
        <Button label="저장" onPress={save} disabled={!parsed.ok} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 24 },
  field: { gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: '#208AEF' },
  input: { flex: 1, fontSize: 28, paddingVertical: 8, color: '#111' },
  unit: { fontSize: 24, color: '#111' },
  hint: { color: '#555' },
  error: { color: '#D93025' },
  footer: { marginTop: 'auto' },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/budget-screen-test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Run checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 모두 exit 0

- [ ] **Step 6: Commit**

```bash
git add src/app/budget.tsx __tests__/budget-screen-test.tsx
git commit -m "feat: add current-month budget screen with last-month suggestion"
```

---

### Task 10: 현재 월 홈 화면

**Files:**
- Modify: `src/app/index.tsx` (전체 교체)
- Delete: `__tests__/index-screen-test.tsx`
- Test: `__tests__/home-screen-test.tsx`

**Interfaces:**
- Consumes: `useSession` (Task 6), `ApiError`, `Home` (Task 4), `describeBalance`, `formatUsagePercent`, `formatWon` (Task 2), `monthTitle` (Task 1), `PET_LABELS`, `PET_STATE_COPY` (Task 8), `LoadingView`, `MessageView` (Task 7), `CONNECTION_ERROR` (Task 5)

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/home-screen-test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import HomeScreen from '@/app/index';

const mockApi = { getHome: jest.fn() };
const mockRefreshStage = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
}));

const HOME = {
  month: '2026-10',
  petType: 'CAT',
  petState: 'STABLE',
  budgetAmount: 300000,
  spentAmount: 0,
  usagePercent: 0,
  budgetBalanceAmount: 300000,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshStage.mockResolvedValue(undefined);
});

test('shows pet state, balance, usage, and the first-record guide', async () => {
  mockApi.getHome.mockResolvedValue(HOME);
  await render(<HomeScreen />);

  await screen.findByText('고양이 · 안정');
  screen.getByText('300,000원 남았어요');
  screen.getByText('사용률 0%');
  screen.getByText('300,000원 중 0원 사용');
  screen.getByText('첫 지출을 기록해 보세요');
});

test('shows the over-budget amount', async () => {
  mockApi.getHome.mockResolvedValue({
    ...HOME,
    petState: 'BUDGET_REACHED',
    spentAmount: 310000,
    usagePercent: 103.3,
    budgetBalanceAmount: -10000,
  });
  await render(<HomeScreen />);

  await screen.findByText('10,000원 초과했어요');
  screen.getByText('사용률 103.3%');
  expect(screen.queryByText('첫 지출을 기록해 보세요')).toBeNull();
});

test('re-checks the stage when the budget is missing', async () => {
  mockApi.getHome.mockRejectedValue(new ApiError(409, 'BUDGET_REQUIRED'));
  await render(<HomeScreen />);

  await waitFor(() => expect(mockRefreshStage).toHaveBeenCalledTimes(1));
});

test('offers a retry when the server is unreachable', async () => {
  mockApi.getHome.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(HOME);
  await render(<HomeScreen />);

  await fireEvent.press(await screen.findByRole('button', { name: '다시 시도' }));

  await screen.findByText('고양이 · 안정');
  expect(mockApi.getHome).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/home-screen-test.tsx`
Expected: FAIL (예전 `index.tsx`에는 홈 내용이 없어 `findByText('고양이 · 안정')`이 실패)

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/app/index.tsx
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Home } from '@/api/types';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { describeBalance, formatUsagePercent, formatWon } from '@/lib/money';
import { monthTitle } from '@/lib/month';
import { PET_LABELS, PET_STATE_COPY } from '@/lib/pet';
import { useSession } from '@/session/session-provider';

type HomeLoad = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; home: Home };

function isStageError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'PET_REQUIRED' || error.code === 'BUDGET_REQUIRED');
}

export default function HomeScreen() {
  const { api, refreshStage } = useSession();
  const [load, setLoad] = useState<HomeLoad>({ status: 'loading' });

  const fetchHome = useCallback(
    () =>
      api.getHome().then(
        (home) => setLoad({ status: 'loaded', home }),
        (error: unknown) => {
          // e.g. the month rolled over while the app was open: let the session route to pet/budget.
          if (isStageError(error)) refreshStage().catch(() => setLoad({ status: 'error' }));
          else setLoad({ status: 'error' });
        },
      ),
    [api, refreshStage],
  );

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  function retry() {
    setLoad({ status: 'loading' });
    fetchHome();
  }

  if (load.status === 'loading') return <LoadingView />;
  if (load.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;

  const { home } = load;
  const petCopy = PET_STATE_COPY[home.petState];
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.month}>{monthTitle(home.month)}</Text>
        <View style={styles.card}>
          <Text style={styles.petLine}>
            {PET_LABELS[home.petType]} · {petCopy.name}
          </Text>
          <Text style={styles.body}>{petCopy.description}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.balance}>{describeBalance(home.budgetBalanceAmount)}</Text>
          <Text style={styles.body}>사용률 {formatUsagePercent(home.usagePercent)}</Text>
          <Text style={styles.caption}>
            {formatWon(home.budgetAmount)} 중 {formatWon(home.spentAmount)} 사용
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>지출 기록</Text>
          {home.spentAmount === 0 && <Text style={styles.body}>첫 지출을 기록해 보세요</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, gap: 16 },
  month: { fontSize: 16, color: '#555' },
  card: { borderRadius: 16, backgroundColor: '#F5F7FA', padding: 20, gap: 8 },
  petLine: { fontSize: 22, fontWeight: '700', color: '#111' },
  balance: { fontSize: 24, fontWeight: '700', color: '#111' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  body: { fontSize: 16, color: '#333' },
  caption: { fontSize: 14, color: '#666' },
});
```

- [ ] **Step 4: Delete the old smoke test and run the new one**

```bash
git rm __tests__/index-screen-test.tsx
npx jest __tests__/home-screen-test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 5: Run checks**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 모두 exit 0

- [ ] **Step 6: Commit**

```bash
git add src/app/index.tsx __tests__/home-screen-test.tsx
git commit -m "feat: add current-month home with pet state and budget balance"
```

---

### Task 11: 통합 확인, QA 검토, PR

**Files:**
- 없음(문제가 발견되면 해당 Task의 파일을 고치고 별도 커밋)

- [ ] **Step 1: Full checks and iOS bundle**

```bash
npm run lint && npm run typecheck && npm test
npx expo export --platform ios --output-dir "$TMPDIR/petgyebu-export-check"
```

Expected: 모두 exit 0, `ios bundles (1)` 출력

- [ ] **Step 2: Start the backend**

```bash
cd ../petgyebu_backend_renewal
PETGYEBU_JWT_SECRET="$(openssl rand -base64 48)" ./gradlew bootTestRun
```

Expected: `Started LocalDevApplication`, 포트 8080. 비밀값은 출력하지 않는다. 시나리오 3에서는 이 서버를 종료하고 같은 명령으로 다시 실행한다(새 비밀값).

- [ ] **Step 3: Configure and start the app**

```bash
cp .env.example .env.local   # EXPO_PUBLIC_DEV_LOGIN_ID를 시나리오마다 새 값으로 바꾼다
xcrun simctl boot 50D6091C-1336-43AC-8BEE-1E7093C75A9C   # iPhone 18 Pro (iOS 27.0)
npm run ios
```

`EXPO_PUBLIC_*`는 번들에 inline되므로 값을 바꾸면 Metro를 재시작한다(`npx expo start --ios --clear`). iOS 27.1의 "iPhone Duo"는 런타임이 깨져 있으므로 켜져 있으면 끈다.

- [ ] **Step 4: Run the simulator scenarios**

각 시나리오 뒤 `xcrun simctl io booted screenshot "$TMPDIR/f-m01-<번호>.png"`로 남긴다. 앱 재실행은 `xcrun simctl terminate booted host.exp.Exponent` 후 Expo Go에서 다시 연다.

| # | 준비 | 동작 | 기대 결과 |
|---|---|---|---|
| 1 | `EXPO_PUBLIC_DEV_LOGIN_ID=qa-first` | 카카오로 시작 → 고양이 → 다음 → 300000 저장 | 펫 선택 → 예산 → 홈. "고양이 · 안정", "300,000원 남았어요", "사용률 0%", "첫 지출을 기록해 보세요" |
| 2 | 1 이후 | 앱 종료 후 다시 실행 | 로그인 화면 없이 홈 |
| 3 | 2 이후 | 백엔드를 새 비밀값으로 재시작 → 앱 다시 실행 | 로그인 화면 |
| 4 | `EXPO_PUBLIC_DEV_LOGIN_ID=qa-pet-only` | 로그인 → 강아지 선택 → 다음 → 앱 종료 → 다시 실행 | 예산 화면부터 |
| 5 | 4의 예산 화면 | `0` 입력, `100000001` 입력 | 저장 버튼 비활성, "1원부터 1억 원까지 입력할 수 있어요" |
| 6 | `EXPO_PUBLIC_DEV_LOGIN_ID=qa-prev`로 로그인해 펫까지 선택한 뒤 아래 SQL로 직전 달 예산 추가 → 앱 다시 실행 | 예산 화면 확인 | 직전 달 금액이 채워지고 "지난달 예산을 불러왔어요". 저장 전 `GET /months/{현재월}/budget`의 `amount`가 `null` |
| 7 | 백엔드 중지 | 앱 다시 실행 → 백엔드 실행 → "다시 시도" | 오류 화면 → 정상 진행 |

시나리오 6 SQL(로컬 개발 DB에만 실행; `budget_month`는 서울 기준 직전 월 1일):

```bash
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "INSERT INTO monthly_budgets (user_id, budget_month, amount) \
   SELECT id, DATE '2026-09-01', 250000 FROM users \
   WHERE provider = 'KAKAO' AND provider_user_id = 'qa-prev';"
```

`provider_user_id`에 실제로 무엇이 저장되는지 먼저 `SELECT provider, provider_user_id FROM users;`로 확인한다. 저장 전 현재 월 예산 확인은 `bootTestRun` 가짜 로그인으로 받은 토큰으로 `curl`해도 되지만, 그 로그인은 앱 세션을 무효화하므로 마지막에 한다.

확인하지 못한 시나리오는 이유와 함께 "미확인"으로 기록한다.

- [ ] **Step 5: Independent QA review**

`app-qa` 에이전트(`.claude/agents/app-qa.md`)에게 `develop...HEAD` 변경을 spec·`docs/00`·`docs/03`·`docs/api-spec.md`와 대조해 검토하게 한다. 지적 사항은 실제 오류부터 고치고, 고친 뒤 Step 1을 다시 실행한다.

- [ ] **Step 6: Push and open the PR**

아래 항목으로 PR 본문을 `$TMPDIR/f-m01-pr.md`에 작성한 뒤 실행한다.

```bash
git push -u origin feature/F-M01-app-onboarding
gh pr create --base develop --title "feat: add onboarding flow from sign-in to current-month home (F-M01)" \
  --body-file "$TMPDIR/f-m01-pr.md"
```

PR 본문 항목: 관련 기능(F-M01·F-M02·F-M04·F-M06)과 사용자 변화, 사용한 API(`auth/login`, `auth/refresh`, `users/me`, `users/me/pet`, `months/{month}/budget` GET·PUT, `home`)와 계약 변경 없음, 확인 기기(iPhone 18 Pro iOS 27.0 시뮬레이터)와 시나리오별 결과, 실제 검사 명령과 결과, 남은 제한(개발용 로그인만 확인, 실제 SDK 미연동, 로그아웃·설정 없음, 펫 그림 없음). 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 7: Confirm CI**

Run: `gh pr checks --watch`
Expected: `check` pass
