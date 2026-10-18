# F-M01 앱 온보딩 설계: 로그인 → 펫 선택 → 현재 월 예산 → 홈

- 작성일: 2026-10-18
- 브랜치: `feature/F-M01-app-onboarding`
- 관련 기능: F-M01(계정과 인증), F-M02(펫 선택), F-M04(월 예산), F-M06(현재 월 홈)
- 기준 문서: `docs/00-renewal-development-guide.md`(우선), `docs/02-requirements-features.md`, `docs/03-user-flow.md` 1·5절, `docs/api-spec.md`

## 1. 목표와 범위

처음 쓰는 사용자가 **로그인 → 펫 선택(CAT·DOG) → 현재 월 예산 설정 → 현재 월 홈**까지 실제로 이동하고, 앱을 다시 열어도 로그인이 유지된다.

**포함**

- 개발용 로그인(백엔드 `bootTestRun`의 가짜 검증기, `credential: "ok:<ID>"`)
- 리프레시 토큰 보관, 앱 시작 시 갱신, 401 처리와 갱신 단일화
- 펫 미선택·예산 미설정 시 홈 진입 차단(둘 다 없으면 펫 먼저)
- 직전 달 예산을 입력란에 제안(저장 전에는 생성하지 않음)
- 현재 월 홈: 펫 상태, 예산 잔액·사용률, 지출 0원일 때 첫 기록 안내

**제외**

- 실제 카카오·구글 SDK 연동(별도 작업)
- 지출 입력·목록(F-M03), 월별 통계(F-M05)
- 설정: 로그아웃 버튼, 펫 변경, 회원 탈퇴
- 펫 그림·애니메이션(리소스 없음, 텍스트로 표시), Figma 시안 반영
- 데이터 캐시 라이브러리(TanStack Query 등). F-M03에서 무한 스크롤·재조회가 필요할 때 다시 검토한다.

## 2. 구조

새 의존성은 `expo-secure-store` 하나다. 서버 데이터는 `fetch` 래퍼와 React Context로 관리한다.

```
src/
  app/                       화면(라우트)만 둔다
    _layout.tsx              SessionProvider, 단계별 Stack.Protected
    sign-in.tsx              로그인
    pet.tsx                  펫 선택
    budget.tsx               현재 월 예산 설정
    index.tsx                현재 월 홈
  api/
    client.ts                Base URL, Bearer 토큰, ApiError, 401 → 단일 갱신 → 1회 재시도
    types.ts                 api-spec 응답 타입
  session/
    session-provider.tsx     세션 상태, 단계 계산, signIn·refreshStage 동작
    token-store.ts           SecureStore의 리프레시 토큰 저장·조회·삭제
    social-credential.ts     공급자별 credential 획득
  lib/
    month.ts                 Asia/Seoul 기준 현재 월·직전 월(YYYY-MM)
    money.ts                 원화 표시, 예산 입력 파싱·검증, 사용률·잔액 표시
    onboarding-stage.ts      (내 정보, 현재 월 예산) → 'pet' | 'budget' | 'ready'
.env.example                 EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_DEV_LOGIN_ID 예시
```

**설정**

- `EXPO_PUBLIC_API_BASE_URL`: API Base URL(`.../api/v1`). `.env.local`에 둔다. 값이 없으면 앱 시작 시 원인을 알 수 있는 오류 화면을 보인다.
- `EXPO_PUBLIC_DEV_LOGIN_ID`: 개발용 로그인 ID. 없으면 `dev-user`.
- 두 값 모두 앱 번들에 포함되므로 비밀값을 넣지 않는다.

## 3. 세션과 데이터 흐름

**토큰 보관**

- 리프레시 토큰만 SecureStore에 저장한다. 액세스 토큰(15분)은 메모리에만 둔다.
- 토큰은 로그·오류 메시지·콘솔에 남기지 않는다.

**세션 상태**

`loading` → `signedOut` | `signedIn(stage)` | `error`. `stage`는 `pet` | `budget` | `ready`.

**앱 시작**

1. SecureStore에서 리프레시 토큰을 읽는다. 없으면 `signedOut`.
2. 있으면 `POST /auth/refresh`. 성공하면 두 토큰을 교체한다. 401이면 저장 토큰을 지우고 `signedOut`.
3. 단계를 계산한다(아래). 끝날 때까지 스플래시 화면을 유지한다.
4. 네트워크 오류·500이면 `error`와 "다시 시도" 화면을 보인다.

**단계 계산**

1. `GET /users/me`. `petType`이 `null`이면 `pet`.
2. 아니면 `GET /months/{현재월}/budget`. `amount`가 `null`이면 `budget`.
3. 둘 다 있으면 `ready`.

펫·예산이 모두 없으면 1에서 `pet`이 되므로 펫이 먼저다.

**로그인**

1. `getSocialCredential(provider)`: `__DEV__`이면 `ok:<EXPO_PUBLIC_DEV_LOGIN_ID>`를 반환한다. 개발 모드가 아니면 "준비 중" 오류를 낸다. SDK 연동 시 이 함수만 교체한다.
2. `POST /auth/login/{provider}` → 토큰 저장 → 단계 계산.

같은 개발용 ID라도 공급자가 다르면 별개 계정이다(문서 2절).

**401 처리(`api/client.ts`)**

- 인증이 필요한 요청이 401이면, 진행 중인 갱신이 있으면 그 결과를 함께 기다리고 없으면 갱신을 시작한다. 갱신 후 원래 요청을 **한 번만** 다시 보낸다.
- 갱신이 401이면 토큰을 지우고 세션을 `signedOut`으로 바꾼다.
- 로그인·갱신 요청 자체는 이 재시도 대상이 아니다.

**화면 이동**

- `_layout`은 세션 상태와 단계에 맞는 화면 하나만 `Stack.Protected`로 연다: `signedOut` → `sign-in`, `pet` → `pet`, `budget` → `budget`, `ready` → `index`.
- 펫·예산 저장 후 단계를 다시 계산하면 guard가 바뀌어 다음 화면으로 자동 이동한다.
- 홈의 `409 PET_REQUIRED`·`BUDGET_REQUIRED`(앱을 켠 채 달이 바뀐 경우 등)는 단계를 다시 계산한다.

## 4. 화면

화면 문구는 초안이다. 스타일은 `StyleSheet`로 단순하게 만든다.

### 로그인 (`sign-in`)

앱 이름과 "카카오로 시작하기"·"구글로 시작하기" 버튼. 요청 중에는 두 버튼을 비활성화하고 로딩을 표시한다.

| 결과 | 표시 |
|---|---|
| 401 `SOCIAL_LOGIN_FAILED` | 로그인에 실패했어요. 다시 시도해 주세요. |
| 503 `SOCIAL_LOGIN_UNAVAILABLE` | 지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요. |
| 네트워크 오류·500 | 서버에 연결할 수 없어요. 다시 시도해 주세요. |
| 개발 모드가 아님 | 아직 준비 중인 로그인이에요. |

### 펫 선택 (`pet`)

"함께할 펫을 골라 주세요"와 고양이(CAT)·강아지(DOG) 카드. 카드를 선택하고 "다음"을 누르면 `PUT /users/me/pet`. 성공하면 단계를 다시 계산한다. 실패하면 선택을 유지하고 오류 문구를 보인다.

### 예산 설정 (`budget`)

- 제목: "{YYYY}년 {M}월 예산"(현재 월). 숫자 키패드, 입력 중 쉼표 표시.
- `GET /months/{직전월}/budget`의 `amount`가 있으면 입력란에 미리 채우고 "지난달 예산을 불러왔어요"를 보인다. 저장하지 않는다. 없거나 조회에 실패하면 비워 둔다.
- 앱 검증: 비어 있으면 "예산을 입력해 주세요", 1 미만·100,000,000 초과면 "1원부터 1억 원까지 입력할 수 있어요". 유효하지 않으면 저장 버튼을 비활성화한다.
- "저장" → `PUT /months/{현재월}/budget` → 성공하면 단계를 다시 계산한다.

| 결과 | 처리 |
|---|---|
| 400 `fields`에 `amount` | 서버 필드 메시지를 입력란 아래에 표시, 입력값 유지 |
| 400 `fields`에 `month` | 화면을 연 사이 달이 바뀐 경우. 단계를 다시 계산하고 새 달로 다시 그린다 |
| 네트워크 오류·500 | 오류 문구, 입력값 유지 |

### 현재 월 홈 (`index`)

화면을 열 때 `GET /home`. 순서는 펫 상태 → 예산 잔액·사용률 → 지출 기록이다.

1. 펫 상태: "고양이 · 안정" 형식과 짧은 설명. 비난·질병·처벌 문구를 쓰지 않는다.

   | `petState` | 이름 | 설명(초안) |
   |---|---|---|
   | `STABLE` | 안정 | 편안하게 지내고 있어요 |
   | `CAUTION` | 주의 | 남은 예산을 눈여겨보고 있어요 |
   | `WARNING` | 경고 | 남은 예산이 신경 쓰이는 눈치예요 |
   | `BUDGET_REACHED` | 예산 도달 | 예산을 모두 사용했어요 |

2. 예산 잔액·사용률
   - `budgetBalanceAmount > 0`: "{N}원 남았어요"
   - `= 0`: "예산을 모두 사용했어요"
   - `< 0`: "{|N|}원 초과했어요"
   - 사용률: API의 `usagePercent`를 그대로 쓰고 소수부가 0이면 `.0`을 숨긴다(`55.0` → "55%", `49.9` → "49.9%"). 상태는 서버의 `petState`를 따르고 앱에서 다시 판정하지 않는다.
   - 보조: "{budgetAmount}원 중 {spentAmount}원 사용"
3. 지출 기록: `spentAmount`가 0이면 "첫 지출을 기록해 보세요" 안내. 기록 버튼·목록은 F-M03에서 만든다.

오류: 로딩 표시. 네트워크 오류·500은 "다시 시도". 409 `PET_REQUIRED`·`BUDGET_REQUIRED`는 단계를 다시 계산한다.

### 공통

- 401은 API 클라이언트가 처리한다. 화면은 따로 처리하지 않는다.
- 알려진 오류 코드는 앱 문구를 쓰고, 입력 오류(400 `fields`)에만 서버 메시지를 보인다.
- 오류를 콘솔에 남길 때 토큰·요청 본문을 넣지 않는다.

## 5. 테스트

Jest 테스트는 `__tests__/`에 둔다. `fetch`와 `expo-secure-store`는 테스트에서 가짜로 바꾼다.

| 대상 | 경우 |
|---|---|
| `onboarding-stage` | 펫 없음 → `pet`; 펫·예산 모두 없음 → `pet`; 펫만 있음 → `budget`; 둘 다 있음 → `ready` |
| `month` | 기기 시간대가 UTC여도 서울 기준 월(서울 다음 달 1일 00:30 → 다음 달); 1월의 직전 월은 전년 12월 |
| `money` 입력 | 빈 값, 0, 1, 100,000,000, 100,000,001, 쉼표 포함, 숫자가 아닌 문자 |
| `money` 표시 | 사용률 `55.0` → "55%", `49.9` → "49.9%"; 잔액 양수·0·음수 문구 |
| `api/client` | Bearer 헤더; 오류 본문 → `ApiError(status, code, fields)`; 401 → 갱신 → 1회 재시도; 동시 401 3건에도 갱신 1회; 갱신 401 → 토큰 삭제·로그아웃 알림; 오류 메시지에 토큰 없음 |
| 예산 화면 | 직전 달 예산 미리 채움·저장 안 함; 범위 밖 금액이면 저장 비활성; 400 `amount` 메시지 표시·입력값 유지 |

화면 이동 규칙은 `onboarding-stage` 테스트와 시뮬레이터 확인으로 검증한다. 라우터 전체 통합 테스트(`renderRouter`)는 이번 범위에서 제외한다.

## 6. 완료 조건

1. `npm run lint`, `npm run typecheck`, `npm test` 통과, CI 통과.
2. `npx expo export --platform ios` 성공(라우팅·의존성 변경).
3. iOS 시뮬레이터(iPhone 18 Pro, iOS 27.0)와 `bootTestRun`을 연결해 확인한다. 화면마다 스크린샷을 남기고, 확인하지 못한 시나리오는 PR에 "미확인"으로 적는다.

   | # | 시나리오 | 기대 결과 |
   |---|---|---|
   | 1 | 새 개발용 ID로 첫 로그인 | 펫 선택 → 예산 → 홈. 안정·0원·첫 기록 안내 |
   | 2 | 앱 종료 후 다시 실행 | 로그인 없이 홈 |
   | 3 | 백엔드 재시작(새 JWT 비밀값) 후 앱 실행 | 갱신 실패 → 로그인 화면 |
   | 4 | 펫만 선택하고 종료 후 다시 실행 | 예산 화면부터 |
   | 5 | 예산 0·1억 원 초과 입력 | 저장 비활성 |
   | 6 | 직전 달 예산이 있는 사용자(로컬 DB에 직접 준비) | 제안값이 채워지고, 저장 전 현재 월 예산은 `null`(API로 확인) |
   | 7 | 백엔드 중지 상태로 실행 | 오류 화면·다시 시도. 백엔드 실행 후 다시 시도하면 정상 진행 |

   6번은 과거 월 예산을 API로 만들 수 없어 로컬 개발 DB에만 직접 넣는다.
4. `app-qa`가 변경을 `00`·`03`·`api-spec`과 대조해 독립 검토하고, 지적 사항을 반영한다.
5. `develop`으로 PR. 본문에 기능 ID, 사용한 API(`auth/login`, `auth/refresh`, `users/me`, `users/me/pet`, `months/{month}/budget` GET·PUT, `home`), 확인 기기, 실제 검사 결과, 남은 제한(개발용 로그인만 확인)을 적는다.
