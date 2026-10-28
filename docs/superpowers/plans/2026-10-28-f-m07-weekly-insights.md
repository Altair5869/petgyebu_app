# F-M07 인사이트 화면(APP-006) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈에서 들어가는 "이번 주 돌아보기" 화면으로 `GET /api/v1/insights`의 예산 예측, 이번 주 요약, 카테고리별 이번 주·지난주 막대 비교를 보여 준다.

**Architecture:** API 클라이언트에 `getInsights`를 더하고, 문구·날짜 범위·막대 비율은 `src/lib/insights.ts` 순수 함수로 계산한다. `useInsights` 훅이 세대 방식으로 늦은 응답을 버리고, 화면(`src/app/insights.tsx`)은 화면 진입·복귀 때마다 다시 불러온다. 서버 정렬·금액을 그대로 쓰고 앱에서 다시 계산하지 않는다.

**Tech Stack:** Expo Router, React Native, TypeScript, Jest + `@testing-library/react-native`, Maestro.

**Spec:** `docs/superpowers/specs/2026-10-28-f-m07-weekly-insights-design.md`

## Global Constraints

- 백엔드 계약: `GET /api/v1/insights`, 쿼리 없음, 401만 오류. `forecast`의 세 키는 항상 있고 값이 `null`일 수 있다.
- 서버 `categories` 순서·금액을 그대로 쓴다. 재정렬·재계산 금지.
- 문구(그대로): "이 속도면 {M}월 {D}일에 예산을 다 써요", "이 속도면 이번 달 예산 안에서 지낼 수 있어요", "이번 달 예산을 모두 썼어요", "4일부터 이번 달 예측을 보여 드려요", "이번 달 예산이 없어 예측할 수 없어요", "하루 평균 {금액}원", "이번 주에는 지난주보다 {카테고리}에 {금액}원 더 썼어요", "이번 주에는 지난주보다 늘어난 지출이 없어요", "이번 주와 지난주에 기록한 지출이 없어요", "카테고리별 변화", "색 막대 이번 주 · 회색 막대 지난주".
- 홈 링크 "이번 주 돌아보기"(화살표 "→"는 기존 링크처럼 접근성에서 숨김), 화면 헤더 제목 "이번 주 돌아보기", 뒤로 라벨 "뒤로".
- 색: 증가 `colors.danger`, 감소 `#4E7A48`, 변화 없음 `colors.muted`, 이번 주 막대 `CATEGORY_COLORS[category]`, 지난주 막대 `colors.border`, 예측 카드 배경 `colors.secondary`, 나머지 카드 `colors.surface`.
- 금액은 `formatWon`, 날짜는 `formatDay`(`src/lib/month.ts`, "10월 30일")를 재사용한다. 테스트는 `__tests__/`.
- 완료 전 `npm run lint`, `npm run typecheck`, `npm test` 통과. 실행하지 않은 확인은 완료라고 쓰지 않는다.
- 코드 작성·리뷰 시 `.agents/skills/karpathy-guidelines/SKILL.md` 적용.

## Review Focus

- `WILL_EXHAUST`인데 `exhaustionDate`가 `null`이거나 `dailyAverageAmount`가 `null`인 응답: "null월"·"null원"이 보이면 안 된다. 날짜가 없으면 카드 숨김, 평균이 없으면 작은 줄 숨김 (Task 2 테스트).
- 해를 넘는 주(`2026-12-28`~`2027-01-03`): "12월 28일~1월 3일"로 보여야 한다 (Task 2 테스트).
- 화면을 빠르게 떠났다 돌아올 때 늦게 온 이전 응답이 새 결과를 덮으면 안 된다 (Task 3 테스트).
- 한 카테고리만 있고 이번 주 0원(지난주만 지출): 이번 주 막대 길이 0, 요약은 "늘어난 지출이 없어요" (Task 2·4 테스트).
- 서버가 모르는 `status`를 보내도 화면은 뜨고 예측 카드만 숨는다 (Task 2·4 테스트).

---

### Task 1: 인사이트 API 타입과 클라이언트

**Files:**
- Modify: `src/api/types.ts`, `src/api/client.ts` (`getMonthStats` 아래)
- Test: `__tests__/api-client-test.ts`

**Interfaces:**
- Produces (`src/api/types.ts`):
  ```ts
  export type DayRange = { from: string; to: string };
  export type WeeklyCategoryChange = { category: ExpenseCategory; thisWeekAmount: number; lastWeekAmount: number; changeAmount: number };
  export type ForecastStatus = 'NO_BUDGET' | 'BUDGET_REACHED' | 'TOO_EARLY' | 'WILL_EXHAUST' | 'WITHIN_BUDGET';
  export type Forecast = { status: ForecastStatus; dailyAverageAmount: number | null; exhaustionDate: string | null };
  export type Insights = { today: string; weekly: { thisWeek: DayRange; lastWeek: DayRange; categories: WeeklyCategoryChange[] }; forecast: Forecast };
  ```
- Produces (`ApiClient`): `getInsights(): Promise<Insights>`

- [ ] **Step 1: 실패하는 테스트 작성** — `getMonthStats` 테스트와 같은 형식으로 `'gets insights from the insights endpoint with the Bearer token'`: `url === \`${BASE}/insights\``, `init.method === 'GET'`, `bearer(init) === 'Bearer a1'`, 스펙 2절의 `WILL_EXHAUST` 응답(`today: '2026-10-28'`, CAFE·TRANSPORT·FOOD 세 행, `exhaustionDate: '2026-10-30'`)을 `resolves.toEqual`.
- [ ] **Step 2:** `npx jest __tests__/api-client-test.ts -t insights` → FAIL (`getInsights is not a function`).
- [ ] **Step 3:** 타입 추가, `getInsights: () => request<Insights>('GET', '/insights')`.
- [ ] **Step 4:** 같은 명령 → PASS. `npm run typecheck` 통과.
- [ ] **Step 5:** `git commit -m "feat: add insights API client (F-M07)"`

### Task 2: 인사이트 문구·범위·막대 계산 (`src/lib/insights.ts`)

**Files:**
- Create: `src/lib/insights.ts`
- Test: `__tests__/insights-test.ts`

**Interfaces:**
- Consumes: Task 1 타입, `formatWon`(`@/lib/money`), `formatDay`(`@/lib/month`), `CATEGORY_LABELS`(`@/lib/expense`)
- Produces:
  ```ts
  export type ForecastCopy = { title: string; detail: string | null };
  export function forecastCopy(forecast: Forecast): ForecastCopy | null;
  export type WeeklyHeadline =
    | { kind: 'increased'; categoryLabel: string; amountText: string } // amountText = formatWon(changeAmount)
    | { kind: 'noIncrease' }
    | { kind: 'empty' };
  export function weeklyHeadline(categories: WeeklyCategoryChange[]): WeeklyHeadline;
  export function formatDayRange(range: DayRange): string;
  export function formatWeekRanges(thisWeek: DayRange, lastWeek: DayRange): string; // `${this} vs ${last}`
  export type ChangeTone = 'up' | 'down' | 'none';
  export function changeTone(changeAmount: number): ChangeTone;
  export function formatChange(changeAmount: number): string;
  export function maxWeeklyAmount(categories: WeeklyCategoryChange[]): number;
  export function barPercent(amount: number, max: number): number; // 0~100, max가 0이면 0
  export function changeRowLabel(change: WeeklyCategoryChange): string;
  ```

- [ ] **Step 1: 실패하는 테스트 작성** (`__tests__/insights-test.ts`)
  - `forecastCopy`:
    - `{WILL_EXHAUST, 2392, '2026-10-30'}` → `{ title: '이 속도면 10월 30일에 예산을 다 써요', detail: '하루 평균 2,392원' }`
    - `{WILL_EXHAUST, 10000, '2026-11-05'}` → title `'이 속도면 11월 5일에 예산을 다 써요'`
    - `{WITHIN_BUDGET, 0, null}` → `{ title: '이 속도면 이번 달 예산 안에서 지낼 수 있어요', detail: '하루 평균 0원' }`
    - `{BUDGET_REACHED, null, null}` → `{ title: '이번 달 예산을 모두 썼어요', detail: null }`
    - `{TOO_EARLY, null, null}` → `{ title: '4일부터 이번 달 예측을 보여 드려요', detail: null }`
    - `{NO_BUDGET, null, null}` → `{ title: '이번 달 예산이 없어 예측할 수 없어요', detail: null }`
    - `{WILL_EXHAUST, 2392, null}` → `null`; `{WITHIN_BUDGET, null, null}` → `detail: null`
    - `{ status: 'SOMETHING_NEW' as ForecastStatus, … }` → `null`
  - `weeklyHeadline`: 스펙 2절 세 행 → `{ kind: 'increased', categoryLabel: '카페', amountText: '13,000원' }`; 첫 행 change 0 → `noIncrease`; `[FOOD 0/9000/−9000]` → `noIncrease`; `[]` → `empty`.
  - `formatDayRange`: `{2026-10-26, 2026-10-28}` → `'10월 26일~28일'`; `{2026-10-26, 2026-11-01}` → `'10월 26일~11월 1일'`; `{2026-12-28, 2027-01-03}` → `'12월 28일~1월 3일'`; `{2026-10-26, 2026-10-26}` → `'10월 26일'`.
  - `formatWeekRanges({2026-10-26,2026-10-28},{2026-10-19,2026-10-21})` → `'10월 26일~28일 vs 10월 19일~21일'`.
  - `formatChange`: `13000` → `'+13,000'`, `-4000` → `'−4,000'`(U+2212), `0` → `'0'`, `100000000` → `'+100,000,000'`. `changeTone`: 양수 `'up'`, 음수 `'down'`, 0 `'none'`.
  - `maxWeeklyAmount`(세 행) → `21000`, `[]` → `0`. `barPercent(8000, 21000)` ≈ `38.1`(`toBeCloseTo(38.1, 1)`), `barPercent(21000, 21000)` → `100`, `barPercent(0, 9000)` → `0`, `barPercent(0, 0)` → `0`.
  - `changeRowLabel`: CAFE → `'카페, 이번 주 21,000원, 지난주 8,000원, 13,000원 늘었어요'`; FOOD −4000 → `'식비, 이번 주 12,000원, 지난주 16,000원, 4,000원 줄었어요'`; TRANSPORT 0 → `'교통, 이번 주 5,000원, 지난주 5,000원, 변화 없어요'`.
- [ ] **Step 2:** `npx jest __tests__/insights-test.ts` → FAIL (모듈 없음).
- [ ] **Step 3:** 구현. `formatDayRange`는 `formatDay`를 쓰고, 같은 달이면 뒤쪽을 `{D}일`만, `from === to`면 하나만. `formatChange`는 `src/lib/money.ts`의 `formatNumber`를 export해 재사용한다("원" 없이 부호와 숫자만).
- [ ] **Step 4:** 같은 명령 → PASS. `npm run lint`, `npm run typecheck` 통과.
- [ ] **Step 5:** `git commit -m "feat: add weekly insights copy and bar helpers (F-M07)"`

### Task 3: `useInsights` 훅

**Files:**
- Create: `src/hooks/use-insights.ts`
- Test: `__tests__/use-insights-test.ts` (`__tests__/use-month-stats-test.ts` 형식 따름)

**Interfaces:**
- Consumes: Task 1 `ApiClient['getInsights']`, `Insights`
- Produces:
  ```ts
  export type UseInsights = { status: 'loading' | 'error' | 'ready'; insights: Insights | null; reload: () => void };
  export function useInsights(api: Pick<ApiClient, 'getInsights'>): UseInsights;
  ```
  `useMonthStats`와 같은 세대(`useRef`) 방식. `reload`는 상태를 `loading`으로 되돌리고 다시 요청한다. 첫 요청은 호출자가 `reload`로 시작한다(훅이 자동 요청하지 않음).

- [ ] **Step 1: 실패하는 테스트 작성**: `reload` 후 성공 → `{status:'ready', insights}`; 실패 → `{status:'error', insights:null}`; 첫 요청이 늦게 끝나고 두 번째 `reload`가 먼저 끝나면 최종 `insights`는 두 번째 값.
- [ ] **Step 2:** `npx jest __tests__/use-insights-test.ts` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** `git commit -m "feat: add insights loading hook (F-M07)"`

### Task 4: 이번 주 돌아보기 화면과 홈 링크

**Files:**
- Create: `src/app/insights.tsx`, `src/components/forecast-card.tsx`, `src/components/weekly-change-card.tsx`
- Modify: `src/app/_layout.tsx` (ready 그룹에 `<Stack.Screen name="insights" options={{ headerShown: true, title: '이번 주 돌아보기', headerBackTitle: '뒤로' }} />`), `src/app/index.tsx` (월별 통계 링크 아래에 같은 `styles.statsLink` 모양의 링크, `accessibilityRole="link"`, `accessibilityLabel="이번 주 돌아보기"`, `router.push('/insights')`)
- Test: `__tests__/insights-screen-test.tsx`, `__tests__/home-screen-test.tsx`

**Interfaces:**
- Consumes: Task 1~3 전부
- Produces: `ForecastCard({ forecast }: { forecast: Forecast })` — `forecastCopy`가 `null`이면 `null` 렌더. `WeeklyChangeCard({ weekly }: { weekly: Insights['weekly'] })` — 요약 문장 카드 + 카테고리별 변화 카드(또는 빈 상태 카드).

화면 배치(스펙 4절): 스크롤 뷰 안에 `ForecastCard` → 요약 문장 카드 → "카테고리별 변화" 카드. 요약 문장은 카테고리 이름·금액만 굵게(금액은 증가 색). 막대 행은 이름(고정 폭) | 막대 두 개(위 이번 주, 아래 지난주, 너비 `${barPercent}%`) | 변화량(오른쪽 정렬, `changeTone` 색). 각 행은 `accessible` + `accessibilityLabel={changeRowLabel(c)}`, `testID={\`weekly-row-${c.category}\`}`. 각 막대 `testID={\`this-week-bar-${c.category}\`}`/`last-week-bar-…`. 로딩·오류는 `src/app/expenses/index.tsx`와 같은 `ActivityIndicator`/`CONNECTION_ERROR` + `Button label="다시 시도"`. `useFocusEffect(reload)`.

- [ ] **Step 1: 실패하는 테스트 작성** (`__tests__/insights-screen-test.tsx`, `home-screen-test.tsx`의 `useSession`·`expo-router` mock 형식, `mockApi = { getInsights: jest.fn() }`)
  - 스펙 2절 `WILL_EXHAUST` 응답: `'이 속도면 10월 30일에 예산을 다 써요'`, `'하루 평균 2,392원'`, 요약 문장 텍스트(`toHaveTextContent('이번 주에는 지난주보다 카페에 13,000원 더 썼어요')`), `'10월 26일~28일 vs 10월 19일~21일'`, 행 라벨 세 개가 서버 순서(CAFE, TRANSPORT, FOOD)로 존재, `'+13,000'`·`'−4,000'`, `this-week-bar-CAFE` 너비 `'100%'`(`StyleSheet.flatten`), 범례 문구.
  - `categories: []` + `WITHIN_BUDGET 0`: `'이번 주와 지난주에 기록한 지출이 없어요'`, `'하루 평균 0원'`, `'카테고리별 변화'` 없음.
  - 지난주만 FOOD 9,000: `'이번 주에는 지난주보다 늘어난 지출이 없어요'`, `this-week-bar-FOOD` 너비 `'0%'`.
  - 모르는 `status`: 요약·카테고리 카드는 보이고 예측 문구 다섯 개 모두 없음.
  - 실패 → `CONNECTION_ERROR` 문구와 "다시 시도"; 누르면 `getInsights` 2회째 호출 후 내용 표시.
  - 포커스 재실행(`mockFocusEffect()`) 시 `getInsights` 다시 호출.
  - `home-screen-test.tsx`: `link` 역할 "이번 주 돌아보기"를 누르면 `router.push('/insights')`.
- [ ] **Step 2:** `npx jest __tests__/insights-screen-test.tsx __tests__/home-screen-test.tsx` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS. `npm run lint`, `npm run typecheck`, `npm test` 전체 통과(`root-layout-test` 포함).
- [ ] **Step 5:** `git commit -m "feat: add weekly insights screen linked from home (F-M07)"`

### Task 5: 앱 문서에 F-M07 반영

**Files:**
- Modify: `docs/00-renewal-development-guide.md`, `docs/02-requirements-features.md`, `docs/api-spec.md`, `docs/03-user-flow.md`, `docs/07-branch-strategy.md`

- [ ] **Step 1:** `00`·`02`는 `diff docs/<f> ../petgyebu_backend_renewal/docs/<f>`로 보이는 인사이트 관련 차이(8절 "16개 동작, 12개 고유 경로", 16번 행, 인사이트 응답 설명, "예산 소진 예측 (`forecast`)" 절, `F-M01`~`F-M07`, "F-M07 소비 인사이트" 절)를 백엔드 문구 그대로 옮긴다. 그 외 차이는 옮기지 않는다. `02` 범위 행에는 앱 화면 `APP-006`이 이 앱의 "이번 주 돌아보기" 화면임을 덧붙인다.
- [ ] **Step 2:** `api-spec.md`: "통계 API" 다음에 "인사이트 API" 절 — `GET /insights`, 스펙 2절 `WILL_EXHAUST` 응답 예, 상태 표(상태·의미·`dailyAverageAmount`·`exhaustionDate`), "펫·예산이 없어도 200, 오류는 401만". curl 예시 "홈·예산·통계" 묶음에 `# 인사이트` 한 줄 추가(기존 예시 형식).
- [ ] **Step 3:** `03-user-flow.md`: 홈 흐름 절에 "홈 → 이번 주 돌아보기(예측·이번 주 요약·카테고리별 변화) → 뒤로" 한 줄. `07`: `F-M01`~`F-M06` → `F-M01`~`F-M07`.
- [ ] **Step 4:** `grep -n "F-M07\|/insights" docs/*.md`로 다섯 파일 모두 반영 확인.
- [ ] **Step 5:** `git commit -m "docs: add insights API and F-M07 to app docs"`

### Task 6: Maestro 시나리오와 시뮬레이터 확인

**Files:**
- Create: `.maestro/insights/weekly-insights.yaml`
- Modify: `README.md` (시나리오 목록이 있으면 한 줄 추가)

준비: 백엔드 `./gradlew bootTestRun`, `.env.local`의 `EXPO_PUBLIC_DEV_LOGIN_ID`를 새 값으로(바꾸기 전 사용자에게 확인), Metro 재시작. 시나리오 머리말 `APP_URL: ${APP_URL || 'http://127.0.0.1:8081'}`.

- [ ] **Step 1:** 시나리오 작성 — 상단 주석에 준비 조건(`first-login` 직후, 예산 300,000원, 지출 0건). `open-app` → 홈 → "이번 주 돌아보기" → `'이번 주와 지난주에 기록한 지출이 없어요'` 확인 → 뒤로 → 카페 12,000원 기록(`monthly-stats.yaml`의 입력 단계 재사용) → "이번 주 돌아보기" → `'이번 주에는 지난주보다 카페에 12,000원 더 썼어요'`(텍스트가 쪼개지면 `카페, 이번 주 12,000원, 지난주 0원, 12,000원 늘었어요` 행 라벨), `'카테고리별 변화'` 확인. 예측 카드는 "이 속도면|이번 달 예산|4일부터" 중 하나가 보이는지만 확인(날짜 의존).
- [ ] **Step 2:** `maestro test .maestro/onboarding/first-login.yaml && maestro test .maestro/insights/weekly-insights.yaml` → 둘 다 통과. 실패하면 원인을 고치고 다시 실행.
- [ ] **Step 3:** 기존 `.maestro/home/budget-states.yaml`처럼 홈 링크 추가로 깨질 수 있는 홈 시나리오 한 개 이상을 다시 돌려 통과 확인(새 계정 필요 시 사용자 확인).
- [ ] **Step 4:** `git commit -m "test: add Maestro flow for weekly insights (F-M07)"`. 실행한 시나리오와 결과, Android 미확인 여부를 PR 본문용으로 기록.
