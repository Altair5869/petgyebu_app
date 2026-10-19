# F-M03 지출 수정·삭제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이번 달 내역에서 지출을 눌러 금액·날짜·카테고리·메모를 고치거나 지우면 내역과 홈이 바뀐다.

**Architecture:** API 클라이언트에 `getExpense`·`updateExpense`·`deleteExpense`를 더하고 204 응답을 처리한다. 입력 칸을 `ExpenseForm`으로 빼서 입력·수정 화면이 공유한다. 수정 화면 `expenses/[id]`는 불러온 값과 비교해 바뀐 필드만 `PATCH`하고, 저장·삭제 뒤 `router.back()`하면 기존 포커스 조회가 내역과 홈을 갱신한다.

**Tech Stack:** Expo SDK 58, React Native 0.88, Expo Router 58(`useLocalSearchParams`, `router`), `@expo/ui/community/datetime-picker`, TypeScript 6, Jest 30 + `jest-expo` + RNTL 14(`render`·`fireEvent`는 async), Maestro 2.11.

**Spec:** `docs/superpowers/specs/2026-10-19-f-m03-expense-edit-delete-design.md`

## Global Constraints

- 새 의존성 없음.
- 수정 화면 날짜 범위: 이번 달 1일 ~ 오늘(서울 기준). 입력 화면은 지금처럼 2000-01-01 ~ 오늘.
- 수정 화면에서 선택한 카테고리 칩을 다시 눌러도 해제되지 않는다. 입력 화면은 지금처럼 해제된다.
- 저장 버튼: 금액 유효 + 메모 100자 이하 + 바뀐 필드 1개 이상일 때만 활성. `PATCH` 본문은 바뀐 필드만.
- 메모를 비우거나 공백만 남기면 `memo: null`(메모 삭제).
- 문구: 헤더 "지출 수정"; "이미 삭제된 지출이에요"; "지난달 지출은 아직 고칠 수 없어요"; 버튼 "내역으로"·"다시 시도"·"저장"·"삭제"; 확인창 제목 "이 지출을 삭제할까요?", 버튼 "취소"·"삭제"(destructive). 연결 오류는 `CONNECTION_ERROR`.
- 삭제 404는 성공처럼 `router.back()`. 불러오기·저장 404는 "이미 삭제된 지출이에요" + "내역으로".
- 토큰·요청 본문을 로그에 남기지 않는다. 라우트 파일만 `src/app/`. 테스트는 `__tests__/`.
- 코드 작성 시 `.agents/skills/karpathy-guidelines/SKILL.md`. lint 규칙을 끄지 않는다.
- 커밋은 Conventional Commits, 끝에 작성 모델의 `Co-Authored-By` 줄.

## Review Focus

- 메모가 원래 없고 입력란도 비어 있음 → 변경 없음, 저장 비활성(Task 1 테스트 `expenseChanges` + Task 4 테스트).
- 원래 메모 "라떼" 뒤에 공백만 덧붙임("라떼 ") → 문자열이 다르므로 변경으로 본다. 서버가 그대로 저장한다(Task 1 테스트로 동작을 고정).
- 삭제 확인창에서 "삭제"를 두 번 빠르게 누름·저장 중 삭제 누름 → 요청 1번, 저장 중에는 삭제 비활성(Task 4 테스트).
- 저장 실패(연결 오류) 뒤 다시 저장 → 같은 본문으로 다시 요청, 입력 유지(Task 4 테스트).
- 입력 화면 분리 뒤 카테고리 해제·`OTHER` 기본값 회귀 → 기존 입력 화면 테스트가 그대로 통과(Task 3).

---

### Task 1: 날짜·변경 필드 계산

**Files:**
- Modify: `src/lib/month.ts`, `src/lib/expense.ts`, `src/api/types.ts`
- Test: `__tests__/month-test.ts`, `__tests__/expense-test.ts`

**Interfaces:**
- Produces: `firstDayOfMonthInSeoul(now?: Date): string`(`YYYY-MM-01`); `type ExpenseUpdate = Partial<NewExpense>`(types.ts); `expenseChanges(original: NewExpense, edited: NewExpense): ExpenseUpdate` — `edited.memo`는 이미 `parseMemo`로 정리된 값.

- [ ] **Step 1: 실패하는 테스트**

```ts
// month-test.ts
test('first day of the Seoul month flips at 15:00 UTC on the last day', () => {
  expect(firstDayOfMonthInSeoul(new Date('2026-10-31T14:59:59Z'))).toBe('2026-10-01');
  expect(firstDayOfMonthInSeoul(new Date('2026-10-31T15:00:00Z'))).toBe('2026-11-01');
});

// expense-test.ts
const ORIGINAL = { amount: 12000, expenseDate: '2026-10-17', category: 'CAFE', memo: '라떼' } as const;
test.each([
  ['nothing', {}, {}],
  ['amount', { amount: 7000 }, { amount: 7000 }],
  ['date', { expenseDate: '2026-10-03' }, { expenseDate: '2026-10-03' }],
  ['category', { category: 'FOOD' }, { category: 'FOOD' }],
  ['memo text', { memo: '아이스 라떼' }, { memo: '아이스 라떼' }],
  ['memo cleared', { memo: null }, { memo: null }],
  ['trailing space is a change', { memo: '라떼 ' }, { memo: '라떼 ' }],
])('expenseChanges: %s', (_, edit, expected) => {
  expect(expenseChanges(ORIGINAL, { ...ORIGINAL, ...edit })).toEqual(expected);
});
test('no memo before and after is no change', () => {
  const noMemo = { ...ORIGINAL, memo: null };
  expect(expenseChanges(noMemo, noMemo)).toEqual({});
});
```

- [ ] **Step 2:** `npx jest __tests__/month-test.ts __tests__/expense-test.ts` → FAIL(함수 없음)
- [ ] **Step 3:** 세 export 구현. `firstDayOfMonthInSeoul`은 `` `${currentMonth(now)}-01` ``.
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `feat: add expense change detection and Seoul month start`

### Task 2: API 클라이언트 단건 조회·수정·삭제

**Files:**
- Modify: `src/api/client.ts`
- Test: `__tests__/api-client-test.ts`

**Interfaces:**
- Consumes: `ExpenseUpdate`(Task 1)
- Produces: `api.getExpense(id: number): Promise<Expense>`, `api.updateExpense(id: number, body: ExpenseUpdate): Promise<Expense>`, `api.deleteExpense(id: number): Promise<void>`

- [ ] **Step 1: 실패하는 테스트** (기존 `setup`·`jsonResponse`·`bearer` 사용)
  - `getExpense(42)` → `GET {base}/expenses/42`, 지출 객체 반환
  - `updateExpense(42, { amount: 7000, memo: null })` → `PATCH /expenses/42`, 본문 JSON이 정확히 `{"amount":7000,"memo":null}`, `Content-Type: application/json`
  - `deleteExpense(42)` → `DELETE /expenses/42`, 본문 없는 `new Response(null, { status: 204 })`에도 resolve(`undefined`)
  - `updateExpense`가 401을 받으면 갱신 후 새 토큰으로 재시도해 성공
  - `deleteExpense` 404 `{code:'EXPENSE_NOT_FOUND'}` → `ApiError` code `EXPENSE_NOT_FOUND`
- [ ] **Step 2:** `npx jest __tests__/api-client-test.ts` → FAIL
- [ ] **Step 3:** `Method`에 `'PATCH' | 'DELETE'` 추가. `request`는 `res.status === 204`면 본문을 읽지 않고 `undefined as T`. 세 메서드 추가.
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `feat: add expense detail, update, and delete API calls`

### Task 3: 입력 칸을 `ExpenseForm`으로 분리

**Files:**
- Create: `src/components/expense-form.tsx`
- Modify: `src/app/expenses/new.tsx`
- Test: `__tests__/new-expense-screen-test.tsx`(수정하지 않고 그대로 통과해야 함)

**Interfaces:**
- Produces:
  ```ts
  export type ExpenseDraft = { amountText: string; day: string; category: ExpenseCategory | null; memoText: string };
  export type ExpenseField = 'amount' | 'expenseDate' | 'category' | 'memo';
  export type FieldErrors = Partial<Record<ExpenseField, string>>;
  export const EXPENSE_FIELDS: ExpenseField[];          // 서버 fields 중 칸에 붙일 이름
  export function ExpenseForm(props: {
    value: ExpenseDraft;
    onChange: (next: ExpenseDraft, field: ExpenseField) => void;
    fieldErrors: FieldErrors;
    minDay: string;                 // 날짜 선택기 최소일(YYYY-MM-DD)
    allowCategoryClear: boolean;    // false면 선택 칩을 다시 눌러도 유지
  }): JSX.Element;
  ```
  폼은 금액 안내(`parseAmountInput(…,'금액을 입력해 주세요')`)·메모 오류를 스스로 표시한다. 칸 접근성 이름·testID·문구·스타일은 지금 `new.tsx`와 동일하게 옮긴다. `ScrollView`·저장 버튼·`formError`는 화면에 남긴다.

- [ ] **Step 1:** `ExpenseForm` 작성, `new.tsx`가 사용(`minDay='2000-01-01'`, `allowCategoryClear`). `onChange`의 `field`로 그 칸의 서버 오류와 `formError`를 지운다.
- [ ] **Step 2:** `npx jest __tests__/new-expense-screen-test.tsx` → 기존 테스트 모두 PASS
- [ ] **Step 3:** `npm run lint && npm run typecheck` → 통과
- [ ] **Step 4:** 커밋 `refactor: extract shared expense form fields`

### Task 4: 수정 화면

**Files:**
- Create: `src/app/expenses/[id].tsx`
- Modify: `src/app/_layout.tsx`(ready guard에 `<Stack.Screen name="expenses/[id]" options={{ headerShown: true, title: '지출 수정', headerBackTitle: '뒤로' }} />`)
- Test: `__tests__/edit-expense-screen-test.tsx`

**Interfaces:**
- Consumes: `ExpenseForm`·`ExpenseDraft`·`EXPENSE_FIELDS`(Task 3), `api.getExpense/updateExpense/deleteExpense`(Task 2), `expenseChanges`·`firstDayOfMonthInSeoul`(Task 1), `parseMemo`, `parseAmountInput`, `formatAmountInput`, `currentMonth`, `LoadingView`/`MessageView`, `Button`
- Produces: 기본 export `EditExpenseScreen`. 경로 파라미터 `id`(문자열)를 `useLocalSearchParams<{ id: string }>()`로 읽어 `Number(id)`.

화면 상태: `loading | error(다시 시도) | notFound | pastMonth | ready`. `ready`에서 원본(`NewExpense`)과 `ExpenseDraft`를 보관. 저장 본문 = `expenseChanges(원본, { amount, expenseDate: day, category, memo: parseMemo(memoText).memo })`. 삭제 버튼은 저장 버튼 아래 빨간 글씨 `Pressable`(`accessibilityRole="button"`, 이름 "삭제"), `Alert.alert('이 지출을 삭제할까요?', undefined, [{ text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress }])`. 저장 중이거나 삭제 중이면 저장·삭제 모두 비활성이고 중복 요청 없음.

- [ ] **Step 1: 실패하는 테스트** — 목: `useSession`, `expo-router`(`router.back`, `useLocalSearchParams: () => ({ id: '7' })`), 날짜 선택기(기존 입력 화면 테스트의 목 복사, 누르면 이번 달 3일을 돌려주도록), `jest.spyOn(Alert, 'alert')`. 불러오기 기본값 `{ id: 7, amount: 12000, expenseDate: <이번 달 17일 또는 오늘 중 이른 날>, category: 'CAFE', memo: '라떼' }`.
  - `fills the loaded values and disables save until something changes`: 금액 칸 값 "12,000", 메모 칸 "라떼", 카페 칩 `selected`, 저장 `disabled`, `getExpense`가 `7`로 호출
  - `sends only the changed amount and goes back`: 금액 "7000" → 저장 → `updateExpense(7, { amount: 7000 })`, `router.back` 1회
  - `clearing the memo sends memo null`: 메모 "   " → `updateExpense(7, { memo: null })`
  - `tapping the selected category keeps it selected`: 카페 다시 누름 → 여전히 `selected`, 저장 `disabled`
  - `limits the date picker to this month`: 날짜 선택기 목에 넘어온 `minimumDate`가 `seoulDayToDate(firstDayOfMonthInSeoul())`
  - `shows server field errors and keeps input`: `updateExpense`가 `ApiError(400,'INVALID_REQUEST',[{field:'amount',message:'금액 오류'}])` → "금액 오류" 표시, 금액 칸 값 유지
  - `connection error on save keeps input and retry sends the same body`: 첫 저장 reject(`TypeError`) → `CONNECTION_ERROR` 표시 → 다시 저장 → 두 번째 호출 본문 동일
  - `double tap on save sends one request`
  - `not found on load`: `getExpense` reject `ApiError(404,'EXPENSE_NOT_FOUND')` → "이미 삭제된 지출이에요", "내역으로" 누르면 `router.back`
  - `not found on save`: `updateExpense` 404 → 같은 안내
  - `load failure then retry`: 첫 `getExpense` reject → `CONNECTION_ERROR` + "다시 시도" → 다시 시도 → 폼
  - `past-month expense is not editable`: 날짜가 지난달 → "지난달 지출은 아직 고칠 수 없어요"
  - `cancel in the delete confirm sends nothing`: "삭제" → `Alert.alert` 제목 "이 지출을 삭제할까요?" → 취소 버튼(`onPress` 없음) → `deleteExpense` 미호출
  - `confirm delete calls DELETE and goes back`: 확인창 destructive 버튼 `onPress()` → `deleteExpense(7)`, `router.back`
  - `delete not found still goes back`
  - `delete failure shows the connection error and stays`
  - `confirming delete twice sends one request`
- [ ] **Step 2:** `npx jest __tests__/edit-expense-screen-test.tsx` → FAIL
- [ ] **Step 3:** 화면과 레이아웃 구현
- [ ] **Step 4:** 같은 명령 → PASS, `npm run lint && npm run typecheck` 통과
- [ ] **Step 5:** 커밋 `feat: add expense edit screen with delete confirmation`

### Task 5: 내역 행에서 수정 화면으로

**Files:**
- Modify: `src/components/expense-row.tsx`, `src/app/expenses/index.tsx`
- Test: `__tests__/month-expenses-screen-test.tsx`

**Interfaces:**
- Produces: `ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void })` — 행 전체 `Pressable`, `accessibilityRole="button"`, `accessibilityLabel` = `` `${title}, ${formatWon(amount)}` ``

- [ ] **Step 1: 실패하는 테스트** `tapping a row opens its edit screen`: 항목 `{ id: 2, …, memo: '라떼' }` → `getByRole('button', { name: '라떼, 12,000원' })` 누름 → `router.push('/expenses/2')`
- [ ] **Step 2:** `npx jest __tests__/month-expenses-screen-test.tsx` → FAIL
- [ ] **Step 3:** 구현(`router.push(\`/expenses/${item.id}\`)`)
- [ ] **Step 4:** 같은 명령 → PASS(기존 테스트 포함)
- [ ] **Step 5:** 커밋 `feat: open the edit screen from the month expense list`

### Task 6: Maestro 시나리오와 시뮬레이터 확인

**Files:**
- Create: `.maestro/expenses/edit-and-delete.yaml`
- Modify: `README.md`(시나리오 표에 한 줄 + 7번 준비 방법)

시나리오는 스펙 9절 1~6번을 한 흐름으로 잇는다(준비: `first-login` 직후, 예산 300,000원, 지출 0건). 7번(다른 경로 삭제 뒤 저장)은 별도 파일 `.maestro/expenses/edit-deleted.yaml`로, README에 SQL 삭제 단계를 적는다. 입력 칸은 기존 흐름처럼 접근성 이름("지출 금액")과 placeholder로 누른다. 확인창 버튼은 텍스트 "삭제"가 화면 버튼과 겹치므로 확인창이 뜬 뒤 `tapOn: { text: "삭제", index: 1 }` 등 실제로 동작하는 선택자를 확인해 쓴다.

- [ ] **Step 1:** 시나리오 작성
- [ ] **Step 2:** 새 개발용 ID로 Metro 재시작 후 `maestro test .maestro/onboarding/first-login.yaml && maestro test .maestro/expenses/edit-and-delete.yaml` → 통과
- [ ] **Step 3:** `edit-deleted.yaml` 준비·실행 → 통과(못 하면 PR에 "미확인")
- [ ] **Step 4:** 기존 `expenses/record-and-list.yaml` 회귀 실행(새 계정) → 통과
- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test` → 통과
- [ ] **Step 6:** 커밋 `chore: add Maestro flows for expense edit and delete`

### 마무리

- `app-qa`로 브랜치 전체 검토, 지적 반영
- `develop`으로 PR: 기능 ID F-M03, API(`GET/PATCH/DELETE /expenses/{id}`, `GET /months/{month}/expenses`, `GET /home`), 기기(iPhone 18 Pro, iOS 27.0), 실제 실행한 검사와 Maestro 결과, 남은 제한(지난달 지출 수정·월 이동은 F-M05)
