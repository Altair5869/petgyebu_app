# F-M08 카테고리 목표·과거 월 예산(APP-007·APP-008) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 월별 통계 화면에서 그 달 예산을 넣고 고치며, 카테고리 목표 대비 남은 금액을 보고, 목표를 한 화면에서 입력·저장하고, 카테고리를 눌러 그 카테고리 지출만 본다.

**Architecture:** API 클라이언트에 목표 GET/PUT/DELETE와 지출 목록 `category`를 더한다. 문구·막대·입력 합계·저장 순서(`planGoalSaves`)는 `src/lib/goals.ts` 순수 함수로 두고 Jest로 고정한다. 통계 화면은 통계·내역·목표 세 요청을 기존 세대 방식으로 함께 불러오고, 새 화면 두 개(`goals`, `expenses/by-category`)와 달 파라미터를 받는 설정 예산 화면으로 이동한다.

**Tech Stack:** Expo Router(SDK 58), React Native, TypeScript, Jest + `@testing-library/react-native`, Maestro.

**Spec:** `docs/superpowers/specs/2026-10-29-f-m08-category-goals-design.md`

## Global Constraints

- 백엔드 `76f6a4d` 계약(스펙 2절). `{month}`는 2000-01 ~ 서울 기준 현재 월. 카테고리 7개 대문자, 고정 순서 `CATEGORIES`(`src/lib/expense.ts`). 금액 1 ~ 100,000,000 정수.
- 서버의 `remainingAmount`·`usagePercent`·`goals` 순서를 그대로 쓴다. 앱에서 다시 계산하는 것은 입력 화면의 목표 합·더 정할 수 있는 금액뿐.
- 문구(그대로): "카테고리 목표", "고치기 ›", "넣기 ›", "{M}월 예산", "미설정", "목표를 정하려면 이 달 예산이 먼저 있어야 해요.", "{M}월 예산 넣기", "이 달에 정한 목표가 없어요.", "목표 정하기", "목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요.", "{N}원 남음", "{N}원 초과", "{spent}원 / 목표 {goal}원", "예산 {B}원 · 목표 합 {T}원", "더 정할 수 있는 금액 {A}원", "예산보다 {N}원 많아요", "목표 없음", "저장", "저장되지 않았어요", "{YYYY}년 {M}월 카테고리 목표", "{M}월 {카테고리}", "목표 {goal}원 · {N}원 남음|초과", "이 달에 이 카테고리 지출이 없어요", "잘못된 접근이에요", "뒤로".
- 헤더 제목: 목표 입력 "카테고리 목표", 카테고리 지출 "카테고리 지출", 설정 예산 "예산 변경"(그대로). 뒤로 라벨 "뒤로".
- 색: 초과 문구·초과 막대·경고 문장 `colors.danger`, 막대 바탕 `colors.border`, 진행 막대 `CATEGORY_COLORS[category]`, 입력 화면 상단 상자 `colors.secondary`, 카드 `colors.surface`, 보조 글 `colors.muted`.
- 금액은 `formatWon`/`formatNumber`, 금액 입력은 `formatAmountInput`·`parseAmountInput`(오류 문구 기존 그대로 "1원부터 1억 원까지 입력할 수 있어요"), 본문 달 제목 `monthTitle`.
- 인증 토큰을 로그·오류 문구에 넣지 않는다. 테스트는 `__tests__/`.
- 완료 전 `npm run lint`, `npm run typecheck`, `npm test` 통과. 실행하지 않은 확인은 완료라고 쓰지 않는다. 코드 작성·리뷰 시 `.agents/skills/karpathy-guidelines/SKILL.md` 적용.
- `.env.local` 수정은 사용자에게 먼저 묻는다.

## Review Focus

- 통계 화면에서 달을 빠르게 바꿀 때 이전 달 목표 응답이 늦게 와서 새 달 화면에 보이면 안 된다(목표 `month`도 화면 달과 같아야 표시) (Task 5 테스트).
- 서버 값과 같은 금액을 쉼표 형태로 다시 입력한 칸("150,000")은 바뀐 것으로 치면 안 된다. 바뀐 칸이 없으면 저장 버튼 비활성 (Task 6 테스트).
- 저장 버튼을 빠르게 두 번 누르면 요청이 한 벌만 나가야 한다 (Task 6 테스트).
- 카테고리 지출 화면에서 다음 페이지를 불러올 때 `category`가 빠지면 다른 카테고리가 섞인다. 커서와 함께 같은 `category`를 보내야 한다 (Task 3 테스트).
- 예산 줄·목표 카드에서 연 예산 화면에 미래 달·형식 오류 `month`가 들어오면 현재 월로 열려야 한다(잘못된 PUT 금지) (Task 4 테스트).

---

### Task 1: 목표 API 타입·클라이언트와 지출 목록 카테고리 필터

**Files:**
- Modify: `src/api/types.ts`, `src/api/client.ts`(`getInsights` 근처, `getMonthExpenses`)
- Test: `__tests__/api-client-test.ts`

**Interfaces:**
- Produces (`src/api/types.ts`):
  ```ts
  export type CategoryGoal = { category: ExpenseCategory; goalAmount: number; spentAmount: number; remainingAmount: number; usagePercent: number };
  export type CategoryGoals = { month: string; budgetAmount: number | null; goalTotalAmount: number; goalsExceedBudget: boolean; goals: CategoryGoal[] };
  export type CategoryGoalSaved = { month: string; category: ExpenseCategory; amount: number };
  ```
- Produces (`ApiClient`): `getCategoryGoals(month: string): Promise<CategoryGoals>`, `putCategoryGoal(month: string, category: ExpenseCategory, amount: number): Promise<CategoryGoalSaved>`, `deleteCategoryGoal(month: string, category: ExpenseCategory): Promise<void>`, `getMonthExpenses(month: string, cursor?: string, category?: ExpenseCategory): Promise<ExpensePage>`.

- [ ] **Step 1: 실패하는 테스트** (기존 `getMonthStats`·`deleteExpense` 테스트 형식):
  - `'gets category goals for a month'`: `${BASE}/months/2026-09/category-goals`, GET, `Bearer a1`, 스펙 2절의 `goalsExceedBudget: true` 응답(budget 80000, FOOD 40000/3000/37000/7.5, CAFE 60000/70000/-10000/116.6)을 `resolves.toEqual`.
  - `'puts a category goal amount'`: `${BASE}/months/2026-09/category-goals/CAFE`, PUT, body `{"amount":60000}`, 응답 `{month:'2026-09',category:'CAFE',amount:60000}`.
  - `'deletes a category goal and accepts 204'`: `${BASE}/months/2026-09/category-goals/HEALTH`, DELETE, `resolves.toBeUndefined()`.
  - `'filters month expenses by category and keeps it with the cursor'`: `getMonthExpenses('2026-09', 'c 1', 'CAFE')` → URL `${BASE}/months/2026-09/expenses?limit=20&cursor=c%201&category=CAFE`; `getMonthExpenses('2026-09', undefined, 'CAFE')` → `...?limit=20&category=CAFE`; 기존 카테고리 없는 URL 테스트는 그대로 통과.
- [ ] **Step 2:** `npx jest __tests__/api-client-test.ts` → 새 테스트 FAIL.
- [ ] **Step 3:** 타입과 함수 추가. `category`가 있을 때만 `&category=${category}`를 붙인다.
- [ ] **Step 4:** 같은 명령 PASS, `npm run typecheck` 통과.
- [ ] **Step 5:** `git commit -m "feat: add category goal API client and expense category filter (F-M08)"`

### Task 2: 목표 문구·입력 합계·저장 순서 (`src/lib/goals.ts`)

**Files:**
- Create: `src/lib/goals.ts`
- Modify: `src/lib/month.ts`(`monthName`), `src/lib/expense.ts`(`parseCategoryParam`)
- Test: `__tests__/goals-test.ts`, `__tests__/month-test.ts`, `__tests__/expense-test.ts`

**Interfaces:**
- Consumes: Task 1 타입.
- Produces:
  ```ts
  // src/lib/month.ts
  export function monthName(month: string): string;            // '2026-09' → '9월'
  export function parseMonthParam(value: string | undefined, now?: Date): string | null; // 통계 화면 validMonthParam을 옮긴 것
  // src/lib/expense.ts
  export function parseCategoryParam(value: string | undefined): ExpenseCategory | null;
  // src/lib/goals.ts
  export type GoalAmounts = Partial<Record<ExpenseCategory, number>>;
  export type GoalOp = { kind: 'put'; category: ExpenseCategory; amount: number } | { kind: 'delete'; category: ExpenseCategory };
  export type GoalInput = { ok: true; amount: number | null } | { ok: false; error: string };
  export function goalRemaining(remainingAmount: number): { text: string; over: boolean };
  export function goalBarPercent(usagePercent: number): number;
  export function goalProgressText(goal: CategoryGoal): string;     // '120,000원 / 목표 150,000원'
  export function goalRowLabel(goal: CategoryGoal): string;         // 접근성
  export function goalSummaryText(goal: CategoryGoal): string;      // '목표 50,000원 · 12,000원 초과'
  export function goalAmountsOf(goals: CategoryGoal[]): GoalAmounts;
  export function parseGoalInput(text: string): GoalInput;          // '' → {ok:true, amount:null}
  export function goalInputTotal(texts: Record<ExpenseCategory, string>): number; // 잘못된·빈 칸은 0
  export function planGoalSaves(current: GoalAmounts, desired: GoalAmounts, budget: number): GoalOp[];
  ```

- [ ] **Step 1: 실패하는 테스트**
  - `monthName('2026-09') === '9월'`, `monthName('2026-10') === '10월'`. `parseMonthParam`: `'2026-09'` → 그대로, `'2026-9'`·`'1999-12'`·`'2099-01'`·`undefined` → `null`(기존 `month-expenses-screen-test` 경우를 옮김).
  - `parseCategoryParam('CAFE') === 'CAFE'`, `'cafe'`·`'X'`·`undefined` → `null`.
  - `goalRemaining(30000)` → `{text:'30,000원 남음', over:false}`; `goalRemaining(0)` → `{text:'0원 남음', over:false}`; `goalRemaining(-12000)` → `{text:'12,000원 초과', over:true}`.
  - `goalBarPercent(80) === 80`, `goalBarPercent(116.6) === 100`, `goalBarPercent(0) === 0`.
  - `goalRowLabel(FOOD 150000/120000/30000)` === `'식비, 목표 150,000원 중 120,000원 썼어요, 30,000원 남았어요'`; CAFE 50000/62000/-12000 → `'카페, 목표 50,000원 중 62,000원 썼어요, 12,000원 넘었어요'`.
  - `goalSummaryText(CAFE 50000/…/-12000)` === `'목표 50,000원 · 12,000원 초과'`.
  - `parseGoalInput('')` → `{ok:true, amount:null}`; `'150,000'` → 150000; `'0'` → `{ok:false, error:'1원부터 1억 원까지 입력할 수 있어요'}`.
  - `goalInputTotal({FOOD:'150,000', CAFE:'50,000', TRANSPORT:'', SHOPPING:'0', …나머지 ''})` === 200000.
  - `planGoalSaves` (헬퍼 `assertWithinBudget(current, ops, budget)`로 매 단계 합 ≤ 예산도 확인):
    - 변화 없음 → `[]`. 값이 같으면 작업 없음.
    - 새로 넣기만: `({}, {FOOD:100000, CAFE:50000}, 500000)` → `[put FOOD 100000, put CAFE 50000]`.
    - 비우기만: `({FOOD:1, CAFE:2}, {CAFE:2}, 10)` → `[delete FOOD]`.
    - 여유 있는 줄이기: `({FOOD:40000, CAFE:60000}, {FOOD:30000, CAFE:60000}, 100000)` → `[put FOOD 30000]`.
    - 초과 상태 줄이기(스펙 2절): `({FOOD:40000, CAFE:60000}, {FOOD:30000, CAFE:50000}, 80000)` → `[delete FOOD, put CAFE 50000, put FOOD 30000]`.
    - 섞임: `({FOOD:50000, CAFE:50000}, {FOOD:80000, CAFE:20000}, 100000)` → `[put CAFE 20000, put FOOD 80000]`(줄이기 먼저).
    - 비우기가 먼저: `({FOOD:50000, CAFE:50000}, {CAFE:30000, SHOPPING:70000}, 100000)` → `[delete FOOD, put CAFE 30000, put SHOPPING 70000]`.
- [ ] **Step 2:** `npx jest __tests__/goals-test.ts __tests__/month-test.ts __tests__/expense-test.ts` → FAIL.
- [ ] **Step 3:** 구현. `planGoalSaves`는 스펙 4-4:
  ```
  sum = Σcurrent
  ops = []; deferred = []
  for c in CATEGORIES: if current[c] 있고 desired[c] 없음 → ops.push(delete c); sum -= current[c]
  for c in CATEGORIES: if 둘 다 있고 desired < current:
      if sum - current + desired ≤ budget → ops.push(put c desired); sum += desired - current
      else → ops.push(delete c); sum -= current; deferred.push(c)
  for c in deferred → ops.push(put c desired)
  for c in CATEGORIES: if desired 있고 (current 없음 또는 desired > current) → ops.push(put c desired)
  ```
  통계 화면의 `validMonthParam`은 `parseMonthParam`으로 바꿔 쓴다(동작 같음).
- [ ] **Step 4:** 같은 명령 PASS, `npm test` 전체 PASS.
- [ ] **Step 5:** `git commit -m "feat: add category goal copy, input totals and save ordering (F-M08)"`

### Task 3: 목표 훅과 지출 목록 훅 카테고리

**Files:**
- Create: `src/hooks/use-category-goals.ts`
- Modify: `src/hooks/use-month-expenses.ts`
- Test: `__tests__/use-category-goals-test.ts`, `__tests__/use-month-expenses-test.ts`

**Interfaces:**
- Produces: `useCategoryGoals(api: Pick<ApiClient,'getCategoryGoals'>, month: string): { status: 'loading'|'error'|'ready'; goals: CategoryGoals | null; reload: () => void }` — `useMonthStats`와 같은 세대 방식, 마운트 시 자동 요청 없음.
- Produces: `useMonthExpenses(api, month, category?: ExpenseCategory)` — `category`가 있으면 첫 페이지·다음 페이지 모두 `getMonthExpenses(month, cursor, category)`. 없으면 지금과 같은 호출 모양 `getMonthExpenses(month, cursor)`(기존 테스트 유지).

- [ ] **Step 1: 실패하는 테스트**
  - `use-category-goals`: reload → ready·goals; 실패 → error; 두 번 reload 시 첫 응답이 늦게 와도 무시(`use-month-stats-test` 형식 그대로).
  - `use-month-expenses`: `'sends the category with the first page and with the cursor'` — `nextCursor:'n1'` 응답 뒤 `loadMore` → 두 번째 호출 `('2026-09', 'n1', 'CAFE')`. `INVALID_CURSOR` 재시작도 `('2026-09', undefined, 'CAFE')`.
- [ ] **Step 2:** `npx jest __tests__/use-category-goals-test.ts __tests__/use-month-expenses-test.ts` → FAIL.
- [ ] **Step 3:** 구현(`category`는 `fetchPage` 의존성에 포함).
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat: add category goals hook and category-filtered expense pages (F-M08)"`

### Task 4: 설정 예산 화면에 달 파라미터

**Files:**
- Modify: `src/app/settings/budget.tsx`
- Test: `__tests__/settings-budget-screen-test.tsx`

**Interfaces:**
- Consumes: `parseMonthParam`(Task 2).
- Produces: 경로 `/settings/budget?month=YYYY-MM`. 파라미터가 없거나 `parseMonthParam`이 `null`이면 현재 월.

- [ ] **Step 1: 실패하는 테스트** (테스트 파일의 `expo-router` 목에 `useLocalSearchParams` 추가)
  - `'opens a past month from the month param and saves it'`: params `{month:'2026-09'}`(현재 월보다 이전이 되도록 `previousMonth(currentMonth())` 사용) → `getBudget(prev)`, 제목 `monthTitle(prev) + ' 예산'`, 저장 → `putBudget(prev, 250000)`, `router.back`.
  - `'shows the server month message for a past month instead of refreshing the stage'`: 과거 달 PUT이 400 `month` 필드 오류 → 그 문구 표시, `refreshStage` 호출 안 함.
  - `'ignores a future or malformed month param'`: `{month:'2099-01'}` → `getBudget(currentMonth())`.
  - 기존 테스트(파라미터 없음 → 현재 월, 현재 월 `month` 오류 → `refreshStage`)는 그대로 통과.
- [ ] **Step 2:** `npx jest __tests__/settings-budget-screen-test.tsx` → FAIL.
- [ ] **Step 3:** 구현. `refreshStage` 분기는 `month === currentMonth()`일 때만.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat: let the budget screen edit past months (F-M02)"`

### Task 5: 월별 통계 화면 — 예산 줄, 목표 카드, 카테고리 누르기

**Files:**
- Create: `src/components/category-goals-card.tsx`
- Modify: `src/components/month-summary-card.tsx`, `src/components/category-breakdown.tsx`, `src/app/expenses/index.tsx`
- Test: `__tests__/category-goals-card-test.tsx`(새), `__tests__/month-summary-card-test.tsx`, `__tests__/category-breakdown-test.tsx`, `__tests__/month-expenses-screen-test.tsx`

**Interfaces:**
- Consumes: Task 1~4.
- Produces:
  - `MonthSummaryCard({ stats, onEditBudget }: { stats: MonthStats; onEditBudget?: () => void })` — `onEditBudget`가 있으면 예산 줄 표시. 줄 하나가 버튼, 접근성 라벨 `'9월 예산 300,000원, 고치기'` / `'9월 예산 미설정, 넣기'`.
  - `CategoryBreakdown({ categories, onSelect }: { …; onSelect?: (c: ExpenseCategory) => void })` — 있으면 줄이 버튼, 오른쪽 "›"(접근성 숨김).
  - `CategoryGoalsCard({ goals, onEditGoals, onAddBudget, onSelect }: { goals: CategoryGoals; onEditGoals: () => void; onAddBudget: () => void; onSelect: (c: ExpenseCategory) => void })` — 스펙 4-1 표. 달 이름은 `monthName(goals.month)`.
  - 이동: 예산 → `router.push({ pathname: '/settings/budget', params: { month } })`; 목표 → `router.push({ pathname: '/goals', params: { month } })`; 카테고리 → `router.push({ pathname: '/expenses/by-category', params: { month, category } })`. (`goals`·`expenses/by-category` 경로는 Task 6·7에서 생기므로 이 Task에서 typedRoutes 오류가 나면 두 경로에 최소 화면 파일을 먼저 만들고 Task 6·7에서 채운다.)

- [ ] **Step 1: 실패하는 테스트**
  - 카드: 예산 없음 → 문장과 "9월 예산 넣기" 버튼(누르면 `onAddBudget`); 목표 없음 → "이 달에 정한 목표가 없어요."·"목표 정하기"(→ `onEditGoals`); 목표 있음 → "30,000원 남음", "12,000원 초과"(빨강 스타일), "120,000원 / 목표 150,000원", 막대 `testID` `goal-bar-CAFE` 너비 `'100%'`, "고치기 ›" → `onEditGoals`, 줄 누르기 → `onSelect('FOOD')`; `goalsExceedBudget: true` → 경고 문장.
  - 요약 카드: 예산 300000 → "9월 예산"·"300,000원"·"고치기 ›"; `budgetAmount: null` → "미설정"·"넣기 ›"; `onEditBudget` 없으면 줄 없음.
  - 비율 카드: `onSelect` 있을 때 줄 누르기 → `onSelect('CAFE')`.
  - 통계 화면: 목표 카드가 보이고 `getCategoryGoals(currentMonth())` 호출; 목표 실패 → `CONNECTION_ERROR`·"다시 시도"(세 요청 다시); 달을 바꿨는데 이전 달 목표 응답이 늦게 오면 보이지 않음(Review Focus); 예산 줄 누르기 → `router.push({pathname:'/settings/budget', params:{month}})`; 카테고리 줄 → by-category push.
- [ ] **Step 2:** `npx jest __tests__/category-goals-card-test.tsx __tests__/month-summary-card-test.tsx __tests__/category-breakdown-test.tsx __tests__/month-expenses-screen-test.tsx` → FAIL.
- [ ] **Step 3:** 구현. 통계 화면 `ready` 조건에 `goals.status === 'ready' && goals.goals?.month === month` 추가, `failed`에 목표 오류 추가, `reload`가 세 훅을 모두 다시 부른다. 카드 순서: 요약 → 목표 → 비율.
- [ ] **Step 4:** PASS, `npm run lint`·`npm run typecheck`.
- [ ] **Step 5:** `git commit -m "feat: show category goals and month budget editing on monthly stats (F-M08)"`

### Task 6: 카테고리 목표 입력 화면

**Files:**
- Create(또는 Task 5의 최소 파일 채움): `src/app/goals.tsx`
- Modify: `src/app/_layout.tsx`(ready 그룹에 `goals`, 제목 "카테고리 목표", 뒤로 "뒤로")
- Test: `__tests__/goals-screen-test.tsx`, `__tests__/root-layout-test.tsx`(경로 등록을 검사하는 기존 방식이 있으면 따름)

**Interfaces:**
- Consumes: `getCategoryGoals`, `putCategoryGoal`, `deleteCategoryGoal`, `parseMonthParam`, `goalAmountsOf`, `parseGoalInput`, `goalInputTotal`, `planGoalSaves`, `ApiError`, `errorMessage`.
- Produces: 경로 `/goals?month=YYYY-MM`. 잘못된 `month` → "잘못된 접근이에요"와 "뒤로"(`router.back`).

화면 동작은 스펙 4-3·4-4 그대로. 저장 흐름:
1. 바쁜 표시(ref로 두 번 누르기 막기) → `getCategoryGoals(month)` 다시.
2. 새 예산이 `null`이면 예산 없음 화면으로. `goalInputTotal > budget`이면 보내지 않고 오류 문장 "목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요."와 상자 숫자 갱신.
3. `planGoalSaves(goalAmountsOf(fresh.goals), desired, fresh.budgetAmount)` 작업을 순서대로 await. 실패하면 멈추고 다시 GET(성공 시 서버 값 ≠ 입력인 칸에 "저장되지 않았어요"), 오류 문장은 409면 `ApiError`의 서버 `message`, 400 `amount` 필드면 그 칸 아래 필드 문구, 그 밖은 `errorMessage(e)`. (`ApiError`에 `message` 본문이 없으면 `request`가 본문 `message`를 보관하도록 최소 확장하고 Task 1 테스트 파일에 한 줄 추가.)
4. 모두 성공 → `router.back()`.

- [ ] **Step 1: 실패하는 테스트**
  - 처음 값: 서버 FOOD 150000·CAFE 50000, 예산 500000 → 칸 "150,000"·"50,000", 나머지 빈 칸, "예산 500,000원 · 목표 합 200,000원", "더 정할 수 있는 금액 300,000원".
  - 입력하면 상자 숫자 바로 바뀜; 합이 예산 초과 → "예산보다 30,000원 많아요", 저장 비활성.
  - 바뀐 칸 없음(같은 값 다시 입력 포함) → 저장 비활성. 잘못된 칸("0") → 칸 아래 오류, 저장 비활성.
  - 저장 성공: CAFE 비우기 + SHOPPING 80000 → 다시 GET 1회, `deleteCategoryGoal(month,'CAFE')` 뒤 `putCategoryGoal(month,'SHOPPING',80000)`, `router.back`.
  - 초과 상태 줄이기(예산 80000, FOOD 40000·CAFE 60000 → 30000·50000): 호출 순서 delete FOOD → put CAFE 50000 → put FOOD 30000.
  - 중간 실패: 두 번째 PUT이 409 `CATEGORY_GOALS_EXCEED_BUDGET` → 세 번째는 안 보냄, 다시 GET, 그 칸 "저장되지 않았어요", 서버 문구 "카테고리 목표 합계가 월 예산을 넘을 수 없습니다." 표시, `router.back` 안 함.
  - 저장 직전 GET에서 예산이 낮아져 합 초과 → PUT/DELETE 0회, 경고 문장.
  - 빠르게 두 번 누르기 → GET·PUT 한 벌.
  - 예산 없는 달 → "목표를 정하려면 이 달 예산이 먼저 있어야 해요."와 "9월 예산 넣기"(→ `/settings/budget` push).
  - 불러오기 실패 → `CONNECTION_ERROR`·"다시 시도".
  - 잘못된 `month` → "잘못된 접근이에요".
- [ ] **Step 2:** `npx jest __tests__/goals-screen-test.tsx` → FAIL.
- [ ] **Step 3:** 구현(키보드 처리는 설정 예산 화면처럼 `KeyboardAvoidingView` + `ScrollView`, 칸 접근성 라벨 "식비 목표 금액").
- [ ] **Step 4:** PASS, `npm test`·lint·typecheck.
- [ ] **Step 5:** `git commit -m "feat: add category goal editing screen with ordered saves (F-M08)"`

### Task 7: 카테고리 지출 화면과 지출 수정 돌아가기

**Files:**
- Create(또는 채움): `src/app/expenses/by-category.tsx`
- Modify: `src/app/_layout.tsx`(`expenses/by-category`, 제목 "카테고리 지출"), `src/app/expenses/[id].tsx`(저장 후 이동)
- Test: `__tests__/category-expenses-screen-test.tsx`, `__tests__/edit-expense-screen-test.tsx`

**Interfaces:**
- Consumes: `useMonthStats`, `useCategoryGoals`, `useMonthExpenses(api, month, category)`, `parseMonthParam`, `parseCategoryParam`, `goalSummaryText`, `goalRemaining`, `ExpenseRow`.
- Produces: 경로 `/expenses/by-category?month&category`. 줄 누르기 → `router.push({ pathname: '/expenses/[id]', params: { id, from: 'category' } })`. 지출 수정은 `from === 'category'`이고 저장된 `expenseDate`의 달이 원래 달과 같으면 `router.back()`, 아니면 기존 `dismissTo`.

- [ ] **Step 1: 실패하는 테스트**
  - `{month:'2026-09'(과거 달로 계산), category:'CAFE'}` → 제목 "9월 카페", 통계의 CAFE `spentAmount` "62,000원", 목표 있으면 "목표 50,000원 · 12,000원 초과", 목록은 `getMonthExpenses(month, undefined, 'CAFE')`.
  - 통계에 그 카테고리가 없으면 "0원"; 목록 비면 "이 달에 이 카테고리 지출이 없어요".
  - 다음 페이지·"다시 시도"·"모든 내역을 불러왔어요"는 통계 화면과 같은 방식(대표 1건: `loadMore`가 `('…', 'n1', 'CAFE')`).
  - 셋 중 실패 → `CONNECTION_ERROR`·"다시 시도". 잘못된 `category`/`month` → "잘못된 접근이에요".
  - 줄 누르기 → `{ pathname:'/expenses/[id]', params:{ id: 7, from:'category' } }`(id 타입은 기존 push 방식과 맞춤).
  - 지출 수정: `from:'category'`·같은 달 저장 → `router.back`; 다른 달 → `dismissTo('/expenses', 새 달)`; `from` 없음 → 기존대로 `dismissTo`.
- [ ] **Step 2:** `npx jest __tests__/category-expenses-screen-test.tsx __tests__/edit-expense-screen-test.tsx` → FAIL.
- [ ] **Step 3:** 구현(`FlatList` 구조는 통계 화면을 따름, 화면 들어올 때·돌아올 때 세 요청 다시).
- [ ] **Step 4:** PASS, `npm test`·lint·typecheck.
- [ ] **Step 5:** `git commit -m "feat: add per-category expense list for a month (F-M08)"`

### Task 8: 앱 문서 맞추기

**Files:**
- Modify: `docs/00-renewal-development-guide.md`, `docs/02-requirements-features.md`, `docs/03-user-flow.md`, `docs/api-spec.md`, `docs/07-branch-strategy.md`

- [ ] **Step 1:** 백엔드 `git -C ../petgyebu_backend_renewal diff 52aa2b0 76f6a4d -- docs/00-renewal-development-guide.md docs/02-requirements-features.md docs/03-user-flow.md`를 보고 스펙 7절 항목을 옮긴다. 앱 문서에서 "API 개수"는 19개 동작·14개 고유 경로.
- [ ] **Step 2:** `api-spec.md`: 예산 PUT 과거 월 허용, 지출 목록 `category` 파라미터·검증 순서, "카테고리 목표 API" 절(GET 응답 예는 스펙 2절 값, PUT 검사 순서와 409 두 가지, DELETE 204), curl 예시 두 줄.
- [ ] **Step 3:** `grep -n "현재 월만\|16개\|F-M07\b" docs/*.md`로 남은 옛 문구가 없는지 확인(인사이트 절의 F-M07 언급은 유지).
- [ ] **Step 4:** `git commit -m "docs: document past month budgets and category goals in app docs (F-M08)"`

### Task 9: Maestro 시나리오와 시뮬레이터 확인

**Files:**
- Create: `.maestro/goals/past-month-budget.yaml`, `.maestro/goals/category-goals.yaml`
- Modify: `.maestro/README.md`(또는 README의 시나리오 표)

시나리오(각각 새 계정, README의 first-login 방식. `.env.local`의 `EXPO_PUBLIC_DEV_LOGIN_ID` 변경은 사용자에게 묻고, 끝나면 `qa-cat-1`로 되돌린다):
- `past-month-budget`: 홈 → "월별 통계 보기" → "이전 달" → "넣기 ›" → 금액 입력·저장 → 통계에 사용률·"남은 예산" 금액이 보이고 목표 카드가 "목표 정하기"로 바뀜.
- `category-goals`: 이번 달 통계 → "목표 정하기" → "식비 목표 금액" 50,000·"카페 목표 금액" 10,000 → 저장 → "50,000원 남음"·"10,000원 남음" → 카페 지출 12,000원 기록 → 통계에서 "2,000원 초과" → 카페 목표 줄 누르기 → "카테고리 지출" 화면에 그 지출만.

- [ ] **Step 1:** `bootTestRun`(76f6a4d)·Metro·시뮬레이터 확인. 키체인 리셋 필요 여부 확인(README 5단계).
- [ ] **Step 2:** 두 시나리오 작성(홈 링크는 `scrollUntilVisible` + `centerElement: true`, 뒤로는 "뒤로|Navigate up").
- [ ] **Step 3:** 각각 실행해 통과 확인, 결과를 기록. 기존 `monthly-stats`·`move-month`·`edit-and-delete` 시나리오도 새 계정으로 한 번 실행해 통계 화면 변경에 깨지지 않는지 확인하고, 깨지면 고친다.
- [ ] **Step 4:** `git commit -m "test: add Maestro flows for past month budget and category goals (F-M08)"`
