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

**기기**: 기본은 iOS 시뮬레이터다. 카카오·구글 SDK 같은 네이티브 모듈을 쓰므로 Expo Go 대신 개발용 앱(Expo development build)을 쓴다. `npm run ios`(`npx expo run:ios`)는 처음 한 번, 또는 네이티브 의존성이 바뀌었을 때만 실행해 앱을 설치한다(번들 ID `com.altair.petgyebu`). 평소에는 `npx expo start --clear`로 Metro만 띄우고 개발용 앱에서 연다. 기기별 API 주소는 `.env.local`의 `EXPO_PUBLIC_API_BASE_URL`에 넣는다.

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
4. iOS 27.0 시뮬레이터를 켜고 개발용 앱을 한 번 설치한다(`npm run ios`). 네이티브 의존성이 바뀌면 다시 설치한다. 시나리오는 `exp+petgyebuapp://?__expo_url=...` 링크(SDK 58 형식)로 앱을 열고 첫 실행 안내를 끈다.
5. 로그인 토큰은 키체인에 남아 앱을 다시 열어도 로그인 상태다. 새 계정으로 처음부터 확인하려면 `xcrun simctl terminate <UDID> com.altair.petgyebu && xcrun simctl keychain <UDID> reset`으로 지운다.

**실행**

```bash
maestro test .maestro/onboarding/first-login.yaml
maestro test -e APP_URL=http://127.0.0.1:8081 .maestro/onboarding/relaunch-home.yaml   # Metro 주소가 다를 때
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
| `stats/monthly-stats.yaml` | 이번 달 통계·카테고리 비중, 지난달(예산 없음), 지출 없는 달, 예산 초과 | `first-login` 직후 + 아래 "지난달 지출 넣기"(지난달 지출 1건, 7,000원·`old`) |
| `stats/move-month.yaml` | 지난달 지출 수정 후 지난달 통계로 복귀, 이번 달 지출을 날짜 선택기로 지난달로 이동(이번 달에서 빠지고 홈 잔액 복원), 같은 화면에서 반복 | `first-login` 직후 + "지난달 지출 넣기"(금액 7,000원, 메모 `old`, 카테고리 `OTHER`). 다시 돌리려면 아래 "move-month 다시 돌리기 전 정리"를 실행하고 `old`를 7,000원으로 되돌린 뒤 이번 달 지출을 지운다 |
| `settings/change-pet-and-budget.yaml` | 설정에서 펫을 강아지로, 이번 달 예산을 450,000원으로 바꾸고 홈에 반영 | `first-login` 직후 |
| `settings/logout.yaml` | 로그아웃 → 로그인 화면 → 다시 로그인하면 홈 | 홈이 보이는 계정 |
| `settings/delete-account.yaml` | 탈퇴 취소, 탈퇴 → 로그인 화면 → 같은 ID로 새 계정(펫 선택부터) | 홈이 보이는 계정 |
| `expenses/validation.yaml` | 빈 금액·101자 메모는 저장 비활성 | 홈 |
| `expenses/paging.yaml` | 25건 통계 화면 무한 스크롤 | 새 개발용 ID, 아래 "이번 달 지출 25건 넣기" |
| `expenses/list-server-unavailable.yaml` | 백엔드가 꺼지면 월별 통계에서 오류와 다시 시도 | 홈이 열린 상태, 백엔드 중지 |
| `expenses/request-timeout.yaml` | 서버가 응답 없이 멈추면 10초 뒤 연결 오류, 지출 저장은 "저장됐는지 확인하지 못했어요" | 홈이 열린 상태, 아래 "서버 응답 멈추기" |

`stats/move-month.yaml`의 날짜 선택기 조작은 화면 비율 좌표 탭(이전 달 화살표, 9월 15일 칸, 헤더로 선택기 닫기)이라 iPhone 18 Pro 기준이고, 실행하는 달이 바뀌면 달력 배치가 달라 15일 칸 좌표를 다시 맞춰야 한다. 모든 기존 흐름은 `monthly-stats` → `move-month` → 나머지 순서로 같은 계정에서 이어 돌릴 수 있다. `move-month`는 `mv`(3,000원)·`mv2`(1,000원)를 지난달로 옮기므로, 다시 돌리기 전에는 아래 SQL로 지난달의 `mv`·`mv2`를 지우고 이번 달 지출을 앱에서 지우거나 `edit-deleted`의 DELETE(계정의 지출 전부 삭제)로 정리한다. 전부 지우면 `old`는 "지난달 지출 넣기"로 다시 넣는다.

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

# move-month 다시 돌리기 전 정리(move-month.yaml): 지난달로 옮겨 둔 mv·mv2 지우기. 로컬 개발 DB에만
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "DELETE FROM expenses WHERE user_id = (SELECT id FROM users WHERE provider = 'KAKAO' AND provider_user_id = '<개발용 ID>') \
   AND memo IN ('mv', 'mv2');"

# 서버 응답 멈추기(request-timeout.yaml): 백엔드 프로세스를 일시정지해 요청이 응답 없이 걸리게 한다. 끝나면 반드시 재개
kill -STOP $(lsof -tiTCP:8080 -sTCP:LISTEN)   # 멈추기
kill -CONT $(lsof -tiTCP:8080 -sTCP:LISTEN)   # 재개. 시간 초과된 저장이 재개 뒤 실제로 기록될 수 있다

# 이번 달 지출 25건 넣기: 로컬 개발 DB에만 실행
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -c \
  "INSERT INTO expenses (user_id, amount, expense_date, category, memo) \
   SELECT u.id, 1000, (now() AT TIME ZONE 'Asia/Seoul')::date, 'OTHER', 'p' || lpad(g::text, 2, '0') \
   FROM users u, generate_series(1, 25) g WHERE u.provider = 'KAKAO' AND u.provider_user_id = '<개발용 ID>';"
```

리프레시 토큰은 DB에 해시로 저장되므로 백엔드를 다시 시작해도(JWT 비밀값이 바뀌어도) 앱 세션은 유지된다.

## 실제 로그인 확인 (카카오·구글)

가짜 로그인 대신 실제 계정으로 `POST /auth/login/{provider}`까지 확인할 때의 절차다. 키 값은 대화·커밋·로그에 남기지 않는다.

**키와 출처**

| 키 | 출처 |
|---|---|
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | 카카오 개발자 콘솔 앱의 네이티브 앱 키. 플랫폼 iOS에 번들 ID `com.altair.petgyebu`를 등록하고 카카오 로그인을 켠다 |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | 구글 클라우드 OAuth 클라이언트 "iOS"(번들 ID 동일) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 구글 클라우드 OAuth 클라이언트 "웹 애플리케이션". ID 토큰의 `aud`가 된다 |
| `PETGYEBU_KAKAO_APP_ID` | 카카오 콘솔의 숫자 앱 ID(백엔드용) |
| `PETGYEBU_GOOGLE_CLIENT_IDS` | 웹 클라이언트 ID(백엔드용) |

구글 OAuth 동의 화면은 테스트 상태로 두고 본인 계정을 테스트 사용자로 추가한다. 클라이언트를 만들 때 "AI 기반 에이전트에 이 클라이언트 사용"은 체크하지 않는다. 앞의 세 키는 번들에 들어가고, `PETGYEBU_*`는 `EXPO_PUBLIC_` 접두사가 없어 번들되지 않는다.

**`.env.local`** (값은 자리표시자)

```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
EXPO_PUBLIC_DEV_LOGIN_ID=
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=<카카오 네이티브 앱 키>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<구글 iOS 클라이언트 ID>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<구글 웹 클라이언트 ID>
PETGYEBU_KAKAO_APP_ID=<카카오 앱 ID>
PETGYEBU_GOOGLE_CLIENT_IDS=<구글 웹 클라이언트 ID>
```

`EXPO_PUBLIC_DEV_LOGIN_ID`가 비어 있어야 실제 로그인 버튼이 SDK를 쓴다.

**앱 빌드**: 키를 넣거나 바꾼 뒤에는 `ios/`를 새로 만들어야 한다. `npx expo run:ios`는 `ios/`가 이미 있으면 다시 만들지 않아서, 키 없는 옛 `ios/`가 남으면 기기 로그에 "KAKAO_APP_KEY is missing from Info.plist"가 뜨고 카카오 버튼이 연결 오류를 보여 준다.

```bash
npx expo prebuild --platform ios --clean
npx expo run:ios
```

**백엔드**: `bootRun`으로 띄운다(`bootTestRun`은 멈춘다). `PETGYEBU_JWT_SECRET`도 필요하며, 값과 만드는 방법은 백엔드 저장소 `petgyebu_backend_renewal/README.md`의 로컬 실행 부분에 있다. 아래는 `.env.local`에서 두 변수만 내보낸다.

```bash
cd ~/Desktop/petgyebu_backend_renewal
set -a; source <(grep -E '^PETGYEBU_(KAKAO_APP_ID|GOOGLE_CLIENT_IDS)=' ~/Desktop/petgyebu_app/.env.local); set +a
./gradlew bootRun
```

엉터리 토큰을 보내 401 `SOCIAL_LOGIN_FAILED`가 오면 설정이 로드된 것이고, 503 `SOCIAL_LOGIN_UNAVAILABLE`이면 설정이 빠진 것이다.

**시뮬레이터**

- iOS 27에서는 버튼을 누르면 먼저 "'petgyebuapp'이(가) 'kauth.kakao.com'(또는 'accounts.google.com')을(를) 사용하여 로그인하려고 합니다" 시스템 창이 뜬다. 여기서 취소하면 문구 없이 로그인 화면으로 돌아온다.
- 계정 정보를 입력하려면 Simulator 앱 창이 열려 있어야 한다(Xcode → Open Developer Tool → Simulator). 하드웨어 키보드는 Mac 입력 소스를 따르므로 영문은 ABC로 바꿔서 입력한다.
- 로그아웃 UI가 아직 없다. 계정을 바꾸려면 위 Maestro 준비 5번의 `terminate` + `keychain reset`을 쓴다.

**가짜 로그인으로 되돌리기**: `EXPO_PUBLIC_DEV_LOGIN_ID`에 처음 쓰는 값을 넣고, 백엔드를 `bootTestRun`으로 바꾸고, `npx expo start --clear`로 Metro를 다시 시작한다. 자세한 순서는 위 "시뮬레이터 자동 확인 (Maestro)"의 준비를 따른다. 키 줄은 그대로 둬도 된다.

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
