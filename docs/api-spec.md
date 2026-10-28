# Petgyebu API 명세 (앱 연동용)

> 원본 계약은 백엔드 저장소 `docs/00-renewal-development-guide.md` §8이다. 이 파일은 2026-10-17에 내보낸 사본이며, API가 바뀌면 백엔드 문서를 먼저 고치고 이 파일을 다시 내보낸다.

## 공통 규칙

15개 API가 모두 구현되어 있습니다. 접두사는 `/api/v1`이고, 기준 문서는 `docs/00-renewal-development-guide.md` §8과 `develop` 브랜치 컨트롤러 코드입니다.

### Base URL

| 환경 | Base URL | 비고 |
| --- | --- | --- |
| 로컬(iOS 시뮬레이터) | `http://localhost:8080/api/v1` | `./gradlew bootTestRun`으로 실행. 서버 포트 설정이 없어 Spring Boot 기본값 8080 |
| 로컬(Android 에뮬레이터) | `http://10.0.2.2:8080/api/v1` | 에뮬레이터에서 호스트 PC를 가리키는 주소 |
| 로컬(실제 기기) | `http://<PC의 LAN IP>:8080/api/v1` | 같은 Wi-Fi에 연결 |
| 스테이징·운영 | 미정 | Cloud Run 배포 후 확정 |

`bootTestRun`은 가짜 소셜 검증기를 씁니다. `credential: "ok:<아무 ID>"`로 로그인할 수 있어 실제 카카오·구글 키 없이 앱을 연동해 볼 수 있습니다. 아래 경로는 모두 Base URL 뒤에 붙입니다.

| 항목 | 규칙 |
| --- | --- |
| 인증 | `Authorization: Bearer <accessToken>`. 로그인·갱신·로그아웃 3개 경로는 이 헤더를 무시하므로 만료된 토큰으로도 호출할 수 있습니다 |
| 본문 | `Content-Type: application/json`. 다른 타입은 415 |
| `{month}` | `YYYY-MM`. 2000-01부터 서울 기준 현재 월까지 허용, 미래 월은 400 |
| 월 경계 | `Asia/Seoul` 기준 `[월 1일, 다음 달 1일)` |
| 금액 | 원화 정수, 1 ~ 100,000,000 |
| 날짜 | `YYYY-MM-DD` |
| 성공 코드 | 지출 생성 201(같은 `Idempotency-Key` 재시도는 200), 지출 삭제·로그아웃·탈퇴 204(본문 없음), 나머지 200 |

### 오류 응답 형식

```json
{
  "code": "INVALID_REQUEST",
  "message": "...",
  "fields": [{ "field": "amount", "message": "..." }]
}
```

`fields`는 입력 오류일 때만 포함됩니다.

### 앱 진입 순서

1. 로그인 후 `GET /users/me`로 `petType`을 확인합니다. `null`이면 펫 선택 화면으로 갑니다.
2. `GET /months/{현재월}/budget`으로 `amount`를 확인합니다. `null`이면 예산 설정 화면으로 갑니다.
3. 둘 다 있으면 `GET /home`을 호출합니다. 설정 전에 호출하면 `409 PET_REQUIRED`나 `409 BUDGET_REQUIRED`가 반환되며, 둘 다 없으면 펫 선택을 먼저 안내합니다.

## 인증 API

서버가 자체 액세스 토큰(15분)과 리프레시 토큰(마지막 사용 후 30일)을 발급합니다. 한 계정에는 한 로그인만 유효해서, 새로 로그인하면 이전 기기의 토큰이 모두 무효화됩니다.

### POST `/auth/login/{provider}`

- `{provider}`: `kakao` 또는 `google`(대소문자 무관)
- 요청: `{ "credential": "..." }`. 카카오는 SDK 액세스 토큰, 구글은 Google Sign-In ID 토큰. 최대 4,096자
- 응답 200: 아래 토큰 응답
- 오류: 400 `INVALID_REQUEST`(`provider`·`credential`), 401 `SOCIAL_LOGIN_FAILED`(토큰 검증 실패), 503 `SOCIAL_LOGIN_UNAVAILABLE`(공급자 장애·설정 누락)

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "...",
  "accessExpiresInSeconds": 900
}
```

### POST `/auth/refresh`

- 요청: `{ "refreshToken": "..." }`
- 응답 200: 로그인과 같은 토큰 응답. 새 리프레시 토큰으로 반드시 교체합니다
- 오류: 401 `UNAUTHORIZED`(만료·무효·이미 사용된 토큰) → 소셜 로그인으로 보냅니다
- 같은 리프레시 토큰은 한 번만 성공합니다. 앱은 갱신 요청을 한 번에 하나만 보내고, 동시에 401을 받은 요청들은 진행 중인 갱신 결과를 기다려 함께 사용합니다

### POST `/auth/logout`

- 요청: `{ "refreshToken": "..." }`
- 응답 204. 앱도 보관한 토큰을 지웁니다

## 사용자 API

### GET `/users/me`

응답 200. `provider`는 `KAKAO | GOOGLE`, `petType`은 `CAT | DOG`이며 선택 전에는 `null`입니다.

```json
{ "id": 1, "provider": "KAKAO", "petType": null }
```

### PUT `/users/me/pet`

- 요청: `{ "petType": "CAT" }`
- 응답 200: 갱신된 내 정보(`GET /users/me`와 같은 형식)
- 오류: `petType` 생략·`null`·그 외 값은 400 `INVALID_REQUEST`
- 펫을 바꿔도 지출·예산은 그대로이고, 현재 월 홈의 펫 종류만 바뀝니다

### DELETE `/users/me`

회원 탈퇴, 응답 204. 지출·예산·계정이 모두 삭제되고 남은 토큰은 이후 401을 받습니다.

## 홈 API

### GET `/home`

현재 월 전용입니다. 펫·금액 요약만 반환하고 카테고리·지출 목록은 포함하지 않습니다.

```json
{
  "month": "2026-10",
  "petType": "CAT",
  "petState": "CAUTION",
  "budgetAmount": 300000,
  "spentAmount": 165000,
  "usagePercent": 55.0,
  "budgetBalanceAmount": 135000
}
```

- 오류: 409 `PET_REQUIRED`(펫 미선택), 409 `BUDGET_REQUIRED`(현재 월 예산 없음)
- `usagePercent`: 소수 첫째 자리 버림. 앱은 소수부가 0이면 `.0`을 숨깁니다
- `budgetBalanceAmount`: 양수는 남은 금액, 0은 예산 도달, 음수는 절댓값만큼 초과

| 실제 사용률 | `petState` |
| --- | --- |
| 0% 이상 50% 미만 | `STABLE` |
| 50% 이상 80% 미만 | `CAUTION` |
| 80% 이상 100% 미만 | `WARNING` |
| 100% 이상 | `BUDGET_REACHED` |

상태는 버림 전 실제 비율로 판정합니다. 예를 들어 실제 49.99%는 `usagePercent: 49.9`, `STABLE`입니다. 100% 초과도 `BUDGET_REACHED`이며, 초과 문구는 음수 잔액으로 판단합니다.

## 지출 API

생성·단건 조회·수정·목록 항목은 모두 같은 지출 객체를 반환합니다.

```json
{ "id": 42, "amount": 12000, "expenseDate": "2026-10-17", "category": "CAFE", "memo": null }
```

| 필드 | 규칙 |
| --- | --- |
| `amount` | 필수, 1 ~ 100,000,000 정수 |
| `expenseDate` | 필수, 2000-01-01 ~ 오늘(서울 기준). 앱 입력칸은 오늘로 미리 채움 |
| `category` | `FOOD, CAFE, TRANSPORT, SHOPPING, HEALTH, LIVING, OTHER`. 생성 시 생략·`null`이면 `OTHER` |
| `memo` | 선택, 최대 100자(코드 포인트). 빈칸·공백만은 `null`로 저장 |

### POST `/expenses`

- 요청: `{ "amount", "expenseDate", "category"?, "memo"? }`
- 헤더 `Idempotency-Key`(선택): UUID(36자, 대소문자 무관). 앱은 같은 입력의 재시도에 같은 키를, 입력이 바뀌면 새 키를 보낸다.
- 응답 201: 지출 객체
- 응답 200: 같은 사용자·같은 키·같은 본문(정규화 후 `amount`, `expenseDate`, `category`, `memo`)의 재요청. 기존 지출 객체
- 응답 409 `IDEMPOTENCY_KEY_REUSED`: 같은 키에 다른 본문
- 응답 400 `INVALID_REQUEST`: 키 형식 오류(field `Idempotency-Key`). 본문 검증이 키 조회보다 먼저다

### GET `/months/{month}/expenses?limit=20&cursor=...`

- `limit`: 기본 20, 1~50 밖이면 400 `INVALID_REQUEST`(보정하지 않음)
- `cursor`: 첫 요청에는 빼고, 이후에는 직전 응답의 `nextCursor`를 그대로 보냅니다. 해석하지 마세요
- 응답 200: `{ "items": [지출 객체...], "nextCursor": "..." }`. 마지막 페이지는 `nextCursor: null`
- 정렬: 날짜 내림차순, 같은 날짜는 ID 내림차순
- 다른 사용자·다른 월의 커서나 잘못된 형식은 400 `INVALID_CURSOR`. 월을 바꾸거나 지출을 생성·수정·삭제하면 커서를 버리고 첫 페이지부터 다시 조회합니다

### GET `/expenses/{expenseId}`

응답 200: 지출 객체. 수정 화면의 초기값으로 씁니다.

### PATCH `/expenses/{expenseId}`

- 보낸 필드만 바뀝니다. `memo: null`은 메모 삭제입니다
- `amount`·`expenseDate`·`category`를 `null`로 보내면 400입니다. 생성의 `OTHER` 기본값은 적용되지 않습니다
- 날짜를 다른 월로 옮길 수 있습니다. 이때 앱은 이전 월과 새 월의 목록·통계를 모두 다시 조회합니다
- 응답 200: 수정된 지출 객체

### DELETE `/expenses/{expenseId}`

응답 204. 없는 ID와 다른 사용자의 ID는 구분 없이 404 `EXPENSE_NOT_FOUND`입니다(조회·수정도 동일).

## 예산 API

예산은 현재 월에만 설정·수정하고, 과거 월은 조회만 할 수 있습니다.

### GET `/months/{month}/budget`

응답 200: `{ "month": "2026-10", "amount": 300000 }`. 예산이 없는 월은 `amount: null`입니다. 미래 월·형식 오류는 400 `INVALID_REQUEST`(`month`)입니다.

### PUT `/months/{month}/budget`

- 요청: `{ "amount": 300000 }`(1 ~ 100,000,000 정수)
- 응답 200(생성·변경 모두): `{ "month", "amount" }`
- 오류: 현재 월이 아닌 `{month}`은 400 `INVALID_REQUEST`(`month`), 금액 오류는 400(`amount`)
- 월 중간에 바꾸면 사용률·잔액·펫 상태가 새 예산으로 즉시 다시 계산됩니다

## 통계 API

### GET `/months/{month}/stats`

현재 월과 과거 월의 숫자 통계를 반환합니다. 펫 필드는 없습니다.

```json
{
  "month": "2026-09",
  "budgetAmount": 300000,
  "spentAmount": 210000,
  "expenseCount": 14,
  "usagePercent": 70.0,
  "budgetBalanceAmount": 90000,
  "categories": [
    { "category": "FOOD", "spentAmount": 120000, "expenseCount": 8, "sharePercent": 57.1 },
    { "category": "CAFE", "spentAmount": 90000, "expenseCount": 6, "sharePercent": 42.9 }
  ]
}
```

- 예산이 없는 월(현재 월 포함)도 200이며, `budgetAmount`·`usagePercent`·`budgetBalanceAmount`만 `null`입니다
- 지출이 0건이면 `spentAmount: 0`, `expenseCount: 0`, `categories: []`
- `categories`: 지출이 있는 항목만 금액 내림차순. 동률이면 `FOOD, CAFE, TRANSPORT, SHOPPING, HEALTH, LIVING, OTHER` 순서
- `sharePercent`: 소수 첫째 자리 **반올림**(`usagePercent`는 버림). 합이 99.9%나 100.1%여도 보정하지 않습니다

## 인사이트 API

### GET `/insights`

서울 기준 오늘의 카테고리별 이번 주·지난주 같은 요일 범위 비교와 현재 월 예산 소진 예측을 반환합니다. 요청 파라미터는 없습니다.

```json
{
  "today": "2026-10-28",
  "weekly": {
    "thisWeek": { "from": "2026-10-26", "to": "2026-10-28" },
    "lastWeek": { "from": "2026-10-19", "to": "2026-10-21" },
    "categories": [
      { "category": "CAFE", "thisWeekAmount": 21000, "lastWeekAmount": 8000, "changeAmount": 13000 },
      { "category": "TRANSPORT", "thisWeekAmount": 5000, "lastWeekAmount": 5000, "changeAmount": 0 },
      { "category": "FOOD", "thisWeekAmount": 12000, "lastWeekAmount": 16000, "changeAmount": -4000 }
    ]
  },
  "forecast": {
    "status": "WILL_EXHAUST",
    "dailyAverageAmount": 2392,
    "exhaustionDate": "2026-10-30"
  }
}
```

- `thisWeek`는 이번 주 월요일~오늘, `lastWeek`는 7일 전 같은 요일 범위이며 양 끝을 포함합니다
- `categories`: 두 범위 중 한쪽에라도 지출이 있는 항목만 `changeAmount`(이번 주 - 지난주, 음수 가능) 내림차순. 동률이면 `FOOD, CAFE, TRANSPORT, SHOPPING, HEALTH, LIVING, OTHER` 순서. 지출이 없으면 빈 배열
- 펫·예산이 없어도 200이며 409는 없습니다. 오류는 인증 실패 401뿐입니다

`forecast.status`는 아래 순서로 처음 맞는 하나입니다.

| `status` | 의미 | `dailyAverageAmount` | `exhaustionDate` |
|---|---|---|---|
| `NO_BUDGET` | 현재 월 예산 없음 | `null` | `null` |
| `BUDGET_REACHED` | 지출이 이미 예산 이상 | `null` | `null` |
| `TOO_EARLY` | 1~3일차라 예측 숨김 | `null` | `null` |
| `WITHIN_BUDGET` | 이 속도로 월말까지 예산 이내 (지출 0건이면 평균 `0`) | `floor(지출 / 일)` | `null` |
| `WILL_EXHAUST` | 이 속도면 월말 전에 예산 소진 | `floor(지출 / 일)` | 예상 소진일 |

## curl 요청 예시

로컬 `bootTestRun` 기준입니다. 먼저 변수를 설정하고, 로그인 응답의 토큰을 `TOKEN`·`REFRESH`에 넣습니다.

```bash
BASE=http://localhost:8080/api/v1
TOKEN=<accessToken>
REFRESH=<refreshToken>
```

### 인증

```bash
# 로그인 (bootTestRun에서는 "ok:<아무 ID>", 실제는 카카오 액세스 토큰·구글 ID 토큰)
curl -X POST "$BASE/auth/login/kakao" \
  -H 'Content-Type: application/json' \
  -d '{"credential":"ok:test-user-1"}'

# 토큰 갱신
curl -X POST "$BASE/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"

# 로그아웃 (204)
curl -X POST "$BASE/auth/logout" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}"
```

### 사용자

```bash
# 내 정보
curl "$BASE/users/me" -H "Authorization: Bearer $TOKEN"

# 펫 선택·변경
curl -X PUT "$BASE/users/me/pet" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"petType":"CAT"}'

# 회원 탈퇴 (204)
curl -X DELETE "$BASE/users/me" -H "Authorization: Bearer $TOKEN"
```

### 홈·예산·통계

```bash
# 현재 월 예산 설정
curl -X PUT "$BASE/months/2026-10/budget" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":300000}'

# 예산 조회
curl "$BASE/months/2026-10/budget" -H "Authorization: Bearer $TOKEN"

# 홈
curl "$BASE/home" -H "Authorization: Bearer $TOKEN"

# 월 통계
curl "$BASE/months/2026-10/stats" -H "Authorization: Bearer $TOKEN"

# 인사이트
curl "$BASE/insights" -H "Authorization: Bearer $TOKEN"
```

### 지출

```bash
# 생성 (201)
curl -X POST "$BASE/expenses" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":12000,"expenseDate":"2026-10-17","category":"CAFE","memo":"라떼"}'

# 월 목록 첫 페이지 / 다음 페이지
curl "$BASE/months/2026-10/expenses?limit=20" -H "Authorization: Bearer $TOKEN"
curl -G "$BASE/months/2026-10/expenses" --data-urlencode "cursor=<nextCursor>" \
  -H "Authorization: Bearer $TOKEN"

# 단건 조회
curl "$BASE/expenses/42" -H "Authorization: Bearer $TOKEN"

# 일부 수정 (메모 삭제 + 금액 변경)
curl -X PATCH "$BASE/expenses/42" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"amount":9000,"memo":null}'

# 삭제 (204)
curl -X DELETE "$BASE/expenses/42" -H "Authorization: Bearer $TOKEN"
```

## 오류 코드

| HTTP | `code` | 의미 | 앱 처리 |
| --- | --- | --- | --- |
| 400 | `INVALID_REQUEST` | 입력 오류, `fields` 포함 | 해당 필드에 오류 표시 |
| 400 | `INVALID_CURSOR` | 커서 형식 오류, 다른 사용자·월의 커서 | 첫 페이지부터 다시 조회 |
| 401 | `UNAUTHORIZED` | 토큰 없음·무효·만료·종료된 로그인(사유 구분 없음) | 갱신 시도, 실패하면 로그인 화면 |
| 401 | `SOCIAL_LOGIN_FAILED` | 소셜 토큰 검증 실패 | 소셜 로그인 다시 |
| 404 | `EXPENSE_NOT_FOUND` | 없거나 다른 사용자의 지출 | 목록 새로고침 |
| 404 | `NOT_FOUND` | 없는 경로 | - |
| 405 | `METHOD_NOT_ALLOWED` | 지원하지 않는 메서드(`Allow` 헤더 포함) | - |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 같은 `Idempotency-Key`에 다른 본문 | 충돌 안내 문구와 월별 통계 확인 안내 |
| 409 | `PET_REQUIRED` | 펫 미선택 상태에서 홈 호출 | 펫 선택 화면 |
| 409 | `BUDGET_REQUIRED` | 현재 월 예산 없이 홈 호출 | 예산 설정 화면 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | JSON이 아닌 본문 | - |
| 500 | `INTERNAL_ERROR` | 서버 오류 | 재시도 안내 |
| 503 | `SOCIAL_LOGIN_UNAVAILABLE` | 카카오·구글 장애 또는 서버 설정 누락 | 잠시 후 다시 안내 |

“앱 처리” 열은 `docs/00`의 화면 흐름에서 정리한 권장안이며 서버 계약은 아닙니다.
