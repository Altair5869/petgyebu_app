# petgyebu_app
펫 감정기반 가계부

## 검사

```bash
npm run lint       # ESLint (eslint-config-expo)
npm run typecheck  # tsc --noEmit
npm test           # Jest (jest-expo, React Native Testing Library)
```

GitHub Actions(`.github/workflows/ci.yml`)가 모든 push·PR에서 lint, typecheck, test를 실행한다.

`expo-env.d.ts`는 git에 올리지 않는 자동 생성 파일이다. 새로 clone했다면 `npx expo start`를 한 번 실행한 뒤 타입 검사를 한다.

## 동작 확인: 지출 입력 → 월 목록 → 홈 갱신

**백엔드**: `petgyebu_backend_renewal` 저장소에서 `./gradlew bootTestRun`을 실행한다(포트 8080). 가짜 소셜 검증기를 쓰므로 `credential: "ok:<아무 ID>"`로 로그인한다.

**기기**: 기본은 iOS 시뮬레이터(`npm run ios`)다. 카카오·구글 SDK처럼 네이티브 모듈이 들어가면 Expo Go 대신 개발 빌드(`npx expo run:ios`)를 쓴다. 기기별 API 주소는 `.env.local`의 `EXPO_PUBLIC_API_BASE_URL`에 넣는다.

| 기기 | `EXPO_PUBLIC_API_BASE_URL` |
| --- | --- |
| iOS 시뮬레이터 | `http://localhost:8080/api/v1` |
| Android 에뮬레이터 | `http://10.0.2.2:8080/api/v1` |
| 실제 기기(같은 Wi-Fi) | `http://<PC LAN IP>:8080/api/v1` |

**확인 순서**: 로그인하고 펫·현재 월 예산을 설정한다. 그다음 지출을 저장하면 `POST /expenses`가 호출되고, 현재 월 목록(`GET /months/{month}/expenses`)을 첫 페이지부터 다시 불러오고, 새 항목이 날짜 내림차순 위치에 보여야 한다. 홈으로 돌아가면 `GET /home`이 다시 호출되어 사용 금액과 펫 상태가 바뀌어야 한다. 앱을 재시작해도 같은 값이 나오는지 확인한다.

## 시뮬레이터 자동 확인 (Maestro)

`.maestro/`에 사용자 흐름 확인 시나리오를 둔다. CI에서는 돌리지 않고, 사용자 흐름을 바꾼 뒤 로컬 iOS 시뮬레이터에서 실행한다.

**준비**

1. Maestro 설치: `brew tap mobile-dev-inc/tap && brew install mobile-dev-inc/tap/maestro` (Java 17 이상, Xcode 필요)
2. 백엔드 `./gradlew bootTestRun` 실행
3. `.env.local`의 `EXPO_PUBLIC_DEV_LOGIN_ID`를 처음 쓰는 값으로 바꾸고 `npx expo start --clear`로 Metro 실행. `EXPO_PUBLIC_*`는 번들에 들어가므로 값을 바꾸면 Metro를 다시 시작한다(실행 명령 앞에 환경 변수를 붙여도 `.env.local` 값이 우선한다).
4. iOS 27.0 시뮬레이터를 켜고 Expo Go를 한 번 연다(`npm run ios`).

**실행**

```bash
maestro test .maestro/onboarding/first-login.yaml
maestro test -e APP_URL=exp://127.0.0.1:8081 .maestro/onboarding/relaunch-home.yaml   # Metro 주소가 다를 때
```

**시나리오와 준비 상태**

| 파일 | 확인 내용 | 준비 |
|---|---|---|
| `onboarding/first-login.yaml` | 로그인 → 고양이 → 예산 300,000원 → 홈 | 새 개발용 ID, 로그인 화면 |
| `onboarding/relaunch-home.yaml` | 재실행 시 로그인 없이 홈 | `first-login` 이후 |
| `onboarding/relaunch-sign-in.yaml` | 세션이 끊기면 로그인 화면 | 아래 "앱 세션 끊기" |
| `onboarding/pet-only-relaunch.yaml` | 펫만 고르고 재실행하면 예산 화면부터 | 새 개발용 ID, 로그인 화면 |
| `onboarding/budget-range.yaml` | 0원·1억 원 초과면 저장 비활성 | 예산 화면이 열린 상태 |
| `onboarding/budget-suggestion.yaml` | 직전 달 예산 제안 | 펫만 고른 계정 + 아래 "직전 달 예산 넣기" |
| `onboarding/server-unavailable.yaml` | 서버가 꺼지면 연결 오류와 다시 시도 | 로그인된 계정, 백엔드 중지 |
| `expenses/record-and-list.yaml` | 지출 기록 → 홈 갱신 → 월별 통계 | `first-login` 직후 |
| `expenses/edit-and-delete.yaml` | 월별 통계에서 수정(금액·메모 지움·칩 유지) → 삭제 취소 → 삭제, 홈 금액 갱신 | `first-login` 직후 |
| `expenses/edit-deleted.yaml` | 수정 화면 중 다른 경로로 지출이 삭제되면 저장 시 안내 | `first-login` 직후 + 아래 "수정 화면 중 지출 지우기" |
| `stats/monthly-stats.yaml` | 이번 달 통계·카테고리 비중, 지난달(예산 없음), 지출 없는 달, 예산 초과 | `first-login` 직후 + 아래 "지난달 지출 넣기"(금액 9,000원 아무 메모) |
| `stats/move-month.yaml` | 지난달 지출 수정 후 지난달 통계로 복귀, 이번 달 지출을 날짜 선택기로 지난달로 이동(이번 달에서 빠지고 홈 잔액 복원), 같은 화면에서 반복 | `first-login` 직후 + "지난달 지출 넣기"(금액 7,000원, 메모 `old`, 카테고리 `OTHER`). 다시 돌리려면 이번 달 지출을 지우고 `old`를 7,000원으로 되돌린다 |
| `expenses/validation.yaml` | 빈 금액·101자 메모는 저장 비활성 | 홈 |
| `expenses/paging.yaml` | 25건 통계 화면 무한 스크롤 | 새 개발용 ID, 아래 "이번 달 지출 25건 넣기" |
| `expenses/list-server-unavailable.yaml` | 백엔드가 꺼지면 월별 통계에서 오류와 다시 시도 | 홈이 열린 상태, 백엔드 중지 |

`stats/move-month.yaml`의 날짜 선택기 조작은 화면 비율 좌표 탭(이전 달 화살표, 9월 15일 칸, 헤더로 선택기 닫기)이라 iPhone 18 Pro 기준이고, 실행하는 달이 바뀌면 달력 배치가 달라 15일 칸 좌표를 다시 맞춰야 한다. 모든 기존 흐름은 `monthly-stats` → `move-month` → 나머지 순서로 같은 계정에서 이번 달 지출만 지우고 이어 돌릴 수 있다.

앱에 아직 로그아웃이 없어서, 다른 계정으로 시작하려면 먼저 앱 세션을 끊는다.

```bash
# 앱 세션 끊기: 같은 계정으로 다른 곳에서 로그인하면 이전 로그인이 무효가 된다(bootTestRun 전용 가짜 로그인)
curl -X POST http://localhost:8080/api/v1/auth/login/kakao \
  -H 'Content-Type: application/json' -d '{"credential":"ok:<현재 개발용 ID>"}'

# 직전 달 예산 넣기: 로컬 개발 DB에만 실행
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "INSERT INTO monthly_budgets (user_id, budget_month, amount) \
   SELECT id, (date_trunc('month', now() AT TIME ZONE 'Asia/Seoul') - interval '1 month')::date, 250000 \
   FROM users WHERE provider = 'KAKAO' AND provider_user_id = '<개발용 ID>';"

# 지난달 지출 넣기(stats/*): 지난달 예산은 넣지 않는다. 로컬 개발 DB에만
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "INSERT INTO expenses (user_id, amount, expense_date, category, memo) \
   SELECT id, 7000, ((now() AT TIME ZONE 'Asia/Seoul')::date - interval '1 month')::date, 'OTHER', 'old' \
   FROM users WHERE provider = 'KAKAO' AND provider_user_id = '<개발용 ID>';"

# 수정 화면 중 지출 지우기(edit-deleted.yaml): 플로우가 "저장" 누르기 전 20초 멈추는 동안 다른 터미널에서 실행. 로컬 개발 DB에만
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "DELETE FROM expenses WHERE user_id = (SELECT id FROM users WHERE provider = 'KAKAO' AND provider_user_id = '<개발용 ID>');"

# 이번 달 지출 25건 넣기: 로컬 개발 DB에만 실행
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "INSERT INTO expenses (user_id, amount, expense_date, category, memo) \
   SELECT u.id, 1000, (now() AT TIME ZONE 'Asia/Seoul')::date, 'OTHER', 'p' || lpad(g::text, 2, '0') \
   FROM users u, generate_series(1, 25) g WHERE u.provider = 'KAKAO' AND u.provider_user_id = '<개발용 ID>';"
```

리프레시 토큰은 DB에 해시로 저장되므로 백엔드를 다시 시작해도(JWT 비밀값이 바뀌어도) 앱 세션은 유지된다.

## Expo

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **src/app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
