# F-M05 월별 통계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이번 달 내역 화면을 월별 통계 화면으로 바꿔, 월을 넘기며 총 지출·건수·사용률·남은 예산·카테고리 비중·전체 내역을 보고, 어느 달 지출이든 수정·삭제하며 날짜를 옮기면 옮긴 달로 돌아오게 한다.

**Architecture:** 라우트 `/expenses`(`src/app/expenses/index.tsx`)를 그대로 쓰되 화면을 통계 화면으로 교체한다. 보는 달은 화면 안 상태이고 선택적 `month` 파라미터로 덮어쓸 수 있다. 통계(`useMonthStats`)와 내역(`useMonthExpenses`)은 달마다 동시에 불러오며 둘 다 성공해야 보인다. 수정 화면은 저장 뒤 `router.dismissTo`로 통계 화면에 수정된 달을 넘긴다.

**Tech Stack:** Expo SDK 58, React Native 0.88, Expo Router 58(`useLocalSearchParams`, `useFocusEffect`, `router.dismissTo`), TypeScript 6, Jest 30 + `jest-expo` + RNTL 14(`render`·`fireEvent`는 async), Maestro.

**Spec:** `docs/superpowers/specs/2026-10-19-f-m05-monthly-stats-design.md`

## Global Constraints

- 새 의존성 없음. 비중 막대는 기본 `View`.
- 달 범위: 2000-01 ~ 이번 달(서울 기준, `currentMonth()`). 미래로 이동 불가.
- 문구: 헤더 "월별 통계"; 홈 링크 "월별 통계"(접근성 role `link`); 월 제목 "{YYYY}년 {M}월"(`monthTitle`); 화살표 접근성 이름 "이전 달"·"다음 달"; 라벨 "총 지출"·"건수"·"사용률"·"남은 예산"·"초과"·"카테고리"·"전체 내역"; 값 "미설정"; 0건 안내 "이 달에는 기록한 지출이 없어요"; 연결 오류 `CONNECTION_ERROR` + "다시 시도".
- 금액 `formatWon`("26,000원"), 건수 "{n}건", 사용률 `formatUsagePercent`, 카테고리 행 "{금액} · {sharePercent}%"(서버 값 그대로, 다시 계산 안 함).
- 남은 예산 칸: `budgetBalanceAmount > 0` → 라벨 "남은 예산", 값 금액; `=== 0` → "남은 예산" "0원"; `< 0` → 라벨 "초과", 값 절댓값; `null` → "남은 예산" "미설정". 사용률 `null` → "미설정".
- 카테고리 색은 코드별 고정. 순서는 서버 응답 그대로.
- "지출 기록하기"는 이번 달을 볼 때만.
- 통계와 첫 내역 페이지 둘 다 성공해야 본문 표시, 하나라도 실패하면 오류. 달을 바꾸면 이전 달 내용을 지우고 로딩. 월 넘기기 줄은 로딩·오류 중에도 보이고 동작.
- 달 이동은 스택에 쌓지 않는다. 통계에서 뒤로 한 번이면 홈.
- 토큰·요청 본문을 로그에 남기지 않는다. 라우트 파일만 `src/app/`. 테스트는 `__tests__/`.
- 코드 작성 시 `.agents/skills/karpathy-guidelines/SKILL.md`. Expo API는 SDK 58 문서(https://docs.expo.dev/versions/v58.0.0/)로 확인. lint 규칙을 끄지 않는다.
- 커밋은 Conventional Commits, 끝에 작성 모델의 `Co-Authored-By` 줄.

## Review Focus

- 달을 빠르게 두 번 넘김(10월 → 9월 → 8월) → 9월 응답이 늦게 와도 8월 숫자만 보인다(Task 3 훅 테스트 + Task 4 화면 테스트).
- 통계는 성공, 첫 내역 페이지는 실패 → 반쪽 화면이 아니라 오류 + 다시 시도, 다시 시도는 둘 다 다시 요청(Task 4 테스트).
- 12월 → 다음 해 1월, 1월 → 이전 해 12월 경계(Task 1 테스트).
- 지난달을 보다가 그 달 지출을 수정해 같은 달로 저장 → 지난달 그대로, 이번 달로 튀지 않음(Task 5 테스트).
- 예산 정확히 소진(잔액 0) → "남은 예산 0원", "초과" 아님(Task 2 테스트).

---

### Task 1: 달 이동 계산과 통계 API

**Files:**
- Modify: `src/lib/month.ts`, `src/api/types.ts`, `src/api/client.ts`, `.gitignore`(`.superpowers/` 한 줄 추가)
- Test: `__tests__/month-test.ts`, `__tests__/api-client-test.ts`

**Interfaces:**
- Produces:
  - `nextMonth(month: string): string`
  - `canGoToPreviousMonth(month: string): boolean` — `month > '2000-01'`
  - `canGoToNextMonth(month: string, now?: Date): boolean` — `month < currentMonth(now)`
  - `type CategoryStat = { category: ExpenseCategory; spentAmount: number; expenseCount: number; sharePercent: number }`
  - `type MonthStats = { month: string; budgetAmount: number | null; spentAmount: number; expenseCount: number; usagePercent: number | null; budgetBalanceAmount: number | null; categories: CategoryStat[] }`
  - `api.getMonthStats(month: string): Promise<MonthStats>` → `GET /months/{month}/stats`

- [ ] **Step 1: 실패하는 테스트**
  - `nextMonth('2026-12') === '2027-01'`, `nextMonth('2026-09') === '2026-10'`; `previousMonth('2027-01') === '2026-12'`(기존 함수 경계 확인)
  - `canGoToPreviousMonth('2000-01') === false`, `('2000-02') === true`
  - `canGoToNextMonth('2026-10', new Date('2026-10-19T00:00:00Z')) === false`, `('2026-09', 같은 now) === true`, `('2026-10', new Date('2026-10-31T15:00:00Z')) === true`(서울은 이미 11월)
  - `getMonthStats('2026-09')` → `GET {base}/months/2026-09/stats`, Authorization 헤더, 응답 객체 그대로
- [ ] **Step 2:** `npx jest __tests__/month-test.ts __tests__/api-client-test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `feat: add month navigation helpers and stats API call`

### Task 2: 요약 카드와 카테고리 비중

**Files:**
- Create: `src/lib/stats.ts`, `src/components/month-summary-card.tsx`, `src/components/category-breakdown.tsx`
- Test: `__tests__/stats-test.ts`, `__tests__/month-summary-card-test.tsx`, `__tests__/category-breakdown-test.tsx`

**Interfaces:**
- Consumes: `MonthStats`, `CategoryStat`(Task 1), `formatWon`, `formatUsagePercent`, `CATEGORY_LABELS`
- Produces:
  - `type SummaryCell = { label: string; value: string }`
  - `summaryCells(stats: MonthStats): [SummaryCell, SummaryCell, SummaryCell]` — 건수·사용률·남은 예산(Global Constraints 규칙)
  - `CATEGORY_COLORS: Record<ExpenseCategory, string>` — 7개 서로 다른 색, 순위가 아니라 카테고리 코드별로 고정
  - `MonthSummaryCard({ stats }: { stats: MonthStats })` — "총 지출" 라벨, 총액(가장 큰 글자), 세 칸
  - `CategoryBreakdown({ categories }: { categories: CategoryStat[] })` — 섹션 라벨 "카테고리", 한 줄 막대(조각마다 `testID="category-bar-{CODE}"`, `flex: sharePercent`, 배경 `CATEGORY_COLORS[code]`), 범례 행(색 점·이름·"{금액} · {비중}%"), 빈 배열이면 "이 달에는 기록한 지출이 없어요"만

- [ ] **Step 1: 실패하는 테스트**
  - `summaryCells`: 예산 300,000/지출 26,000/4건/8.6/274,000 → `[{건수,'4건'},{사용률,'8.6%'},{남은 예산,'274,000원'}]`; 잔액 0 → `{남은 예산,'0원'}`; 잔액 -12,000 → `{초과,'12,000원'}`; 예산 없음 → 사용률 `'미설정'`, `{남은 예산,'미설정'}`; 사용률 70.0 → `'70%'`
  - `CATEGORY_COLORS`: 7개 키, 값이 모두 다름
  - 요약 카드: "총 지출", "26,000원", 세 칸 텍스트 보임
  - 카테고리: 응답 순서대로 "카페"·"16,000원 · 61.5%", "식비"·"8,000원 · 30.8%"; `category-bar-CAFE`의 style에 `flex: 61.5`; 빈 배열 → 안내 문구 있고 "카테고리" 막대 없음
- [ ] **Step 2:** `npx jest __tests__/stats-test.ts __tests__/month-summary-card-test.tsx __tests__/category-breakdown-test.tsx` → FAIL
- [ ] **Step 3:** 구현. 스타일은 브레인스토밍 B안: 요약은 연한 배경 카드(`#F5F8FC` 계열, 둥근 모서리), 세 칸은 흰 칸 가로 배치; 막대 높이 14, 둥근 끝
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `feat: add month summary card and category breakdown`

### Task 3: 통계 불러오기 훅

**Files:**
- Create: `src/hooks/use-month-stats.ts`
- Test: `__tests__/use-month-stats-test.ts`

**Interfaces:**
- Consumes: `api.getMonthStats`(Task 1)
- Produces: `useMonthStats(api: Pick<ApiClient, 'getMonthStats'>, month: string): { status: 'loading' | 'error' | 'ready'; stats: MonthStats | null; reload: () => void }` — `reload`는 `month`가 바뀌면 새 함수(기존 `useMonthExpenses.reload`와 같은 성질: `useFocusEffect(reload)`가 달 변경 시 다시 실행됨). `reload`는 상태를 `loading`·`stats: null`로 되돌리고 요청. 요청 세대 번호로 늦은 응답 무시(`useMonthExpenses` 패턴).

- [ ] **Step 1: 실패하는 테스트**(`renderHook`)
  - reload → 요청 `'2026-10'`, 성공 시 `ready`·stats
  - 실패 → `error`; 다시 reload → 성공 시 `ready`
  - 9월 요청이 걸린 채 month를 8월로 바꾸고 reload → 8월 응답 뒤 9월 응답이 와도 stats는 8월
  - reload 시 이전 stats가 즉시 `null`
- [ ] **Step 2:** `npx jest __tests__/use-month-stats-test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `feat: add month stats hook`

### Task 4: 월별 통계 화면(이번 달 내역 대체)과 홈 링크

**Files:**
- Modify: `src/app/expenses/index.tsx`(통계 화면으로 교체), `src/app/_layout.tsx`(`expenses/index` 제목 "월별 통계"), `src/app/index.tsx`(링크 문구·접근성 이름 "월별 통계", 이동 경로 `/expenses` 유지)
- Create: `src/components/month-navigator.tsx`
- Test: `__tests__/month-expenses-screen-test.tsx`(새 화면에 맞게 다시 씀), `__tests__/home-screen-test.tsx`

**Interfaces:**
- Consumes: Task 1~3 전부, `useMonthExpenses`, `ExpenseRow`, `Button`, `LoadingView`/`MessageView`
- Produces:
  - `MonthNavigator({ month, onChange }: { month: string; onChange: (month: string) => void })` — `‹`(이름 "이전 달")·제목·`›`(이름 "다음 달"), 경계에서 `disabled`
  - 통계 화면은 `useLocalSearchParams<{ month?: string }>()`의 `month`가 오면(형식 `YYYY-MM`) 그 달로 상태를 바꾼다(Task 5가 사용). 없으면 `currentMonth()`.

구성: `FlatList` 하나. 머리 = `MonthNavigator` → (로딩: 작은 로딩 / 오류: `CONNECTION_ERROR` + "다시 시도" / 준비: `MonthSummaryCard` → `CategoryBreakdown` → 이번 달이면 "지출 기록하기" → "전체 내역" 라벨). 본문 = 준비 상태일 때만 내역 행(`ExpenseRow`, 누르면 `/expenses/{id}`). 꼬리 = 기존 추가 로딩·추가 실패 다시 시도·"모든 내역을 불러왔어요"(항목 있을 때). 빈 내역 문구는 없음(카테고리 안내로 대신). 포커스와 달 변경 모두 `stats.reload` + `list.reload`. 다시 시도도 둘 다.

- [ ] **Step 1: 실패하는 테스트**(목: `useSession`, `expo-router`의 `router.push`·`useFocusEffect`·`useLocalSearchParams`)
  - 이번 달로 열림: `getMonthStats`·`getMonthExpenses`가 `currentMonth()`로 호출; 제목 `monthTitle(currentMonth())`; "다음 달" 비활성; "26,000원"·"카페" 보임; "지출 기록하기" 보임
  - "이전 달" 누름 → 두 API가 `previousMonth(currentMonth())`로 호출; "지출 기록하기" 없음; "다음 달" 활성
  - 파라미터 `month: '2000-01'` → "이전 달" 비활성, 그 달로 요청
  - 통계 성공 + 내역 실패 → 연결 오류 문구, 본문 숫자 없음; "다시 시도" → 두 API 다시 호출
  - 빠른 연속 이동: 9월 통계 응답을 붙잡은 채 8월로 이동 → 8월 응답 뒤 9월 응답이 와도 8월 숫자만
  - 행 누르면 `router.push('/expenses/2')`(기존 테스트 유지)
  - 추가 페이지·마지막 페이지 문구(기존 내역 테스트 중 남길 것 유지)
  - 홈: "월별 통계" 링크 → `router.push('/expenses')`
- [ ] **Step 2:** `npx jest __tests__/month-expenses-screen-test.tsx __tests__/home-screen-test.tsx` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 → PASS, `npm run lint && npm run typecheck` 통과
- [ ] **Step 5:** 커밋 `feat: replace the month expense list with monthly stats`

### Task 5: 수정 화면의 과거 월 허용과 수정한 달로 돌아가기

**Files:**
- Modify: `src/app/expenses/[id].tsx`
- Test: `__tests__/edit-expense-screen-test.tsx`

**Interfaces:**
- Consumes: 통계 화면의 `month` 파라미터(Task 4), `api.updateExpense` 응답(`Expense`)
- Produces: 없음

변경:
- `pastMonth` 상태·문구 "지난달 지출은 아직 고칠 수 없어요" 삭제. `ExpenseForm`의 `minDay`를 `'2000-01-01'`로.
- 저장 성공: `router.dismissTo({ pathname: '/expenses', params: { month: saved.expenseDate.slice(0, 7) } })`(`saved`는 `updateExpense` 응답). SDK 58 문서에서 `dismissTo`가 스택에 있는 `/expenses`로 돌아가며 파라미터를 갱신하는지 확인한다. 아니면 같은 결과(스택 홈 → 통계, 통계가 그 달)를 내는 문서화된 방법을 쓰고 보고서에 근거를 적는다.
- 삭제 성공·삭제 404·"내역으로"는 지금처럼 `router.back()`(보던 달 유지).
- 기존 저장 성공 테스트의 `router.back` 기대를 `dismissTo` 기대로 바꾼다.

- [ ] **Step 1: 실패하는 테스트**
  - `opens a past-month expense for editing`: 불러온 날짜 `'2026-09-30'` → 폼 표시, 안내 문구 없음
  - `date picker allows any month since 2000`: 선택기 `minimumDate`가 `seoulDayToDate('2000-01-01')`
  - `saving into another month returns to that month`: 이번 달 지출의 날짜를 선택기 목으로 `2026-09-30`으로 바꿔 저장(응답 날짜 `2026-09-30`) → `router.dismissTo({ pathname: '/expenses', params: { month: '2026-09' } })` 1회
  - `saving within the same past month keeps that month`: 9월 지출 금액만 수정(응답 날짜 9월) → `params.month === '2026-09'`
  - 저장 성공 뒤 두 번째 탭 요청 없음(기존 테스트를 `dismissTo` 1회로)
  - 삭제 성공 → `router.back`(기존 유지)
- [ ] **Step 2:** `npx jest __tests__/edit-expense-screen-test.tsx` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 → PASS, `npm run lint && npm run typecheck && npm test` 통과
- [ ] **Step 5:** 커밋 `feat: allow editing any month and return to the edited month`

### Task 6: Maestro 시나리오와 시뮬레이터 확인

**Files:**
- Create: `.maestro/stats/monthly-stats.yaml`(스펙 9절 1~3·6), `.maestro/stats/move-month.yaml`(4·5)
- Modify: `.maestro/expenses/record-and-list.yaml`, `paging.yaml`, `list-server-unavailable.yaml`, `edit-and-delete.yaml`, `edit-deleted.yaml`("이번 달 내역 보기" → "월별 통계", 바뀐 화면 문구 반영), `README.md`(시나리오 표, 지난달 지출·예산 SQL)

- [ ] **Step 1:** 시나리오 작성. 지난달 데이터는 README에 SQL로(로컬 개발 DB만). 5번 날짜 선택기 조작이 안 되면 SQL로 날짜를 옮긴 뒤 화면 갱신 확인, 선택기 조작은 "미확인".
- [ ] **Step 2:** 새 개발용 ID로 Metro 재시작 후 `first-login` → 새 시나리오들 실행 → 통과
- [ ] **Step 3:** 고친 기존 시나리오 5개 실행(필요한 준비 상태대로) → 통과. 8번(백엔드 중지)은 `list-server-unavailable`로 확인
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` → 통과
- [ ] **Step 5:** 커밋 `chore: add Maestro flows for monthly stats`

### 마무리

- 브랜치 전체 최종 검토, 지적 반영
- `npx expo export --platform ios`
- `develop`으로 PR: 기능 ID F-M05·F-M03 일부, API(`GET /months/{month}/stats`, `GET /months/{month}/expenses`, `GET/PATCH/DELETE /expenses/{id}`, `GET /home`), 기기(iPhone 18 Pro, iOS 27.0), 실제 실행한 검사와 Maestro 결과, 미확인·남은 제한
