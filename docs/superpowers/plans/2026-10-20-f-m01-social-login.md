# F-M01 카카오·구글 실제 로그인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expo Go에서 개발용 앱으로 옮기고, 로그인 버튼이 카카오 SDK 액세스 토큰·구글 ID 토큰을 받아 기존 `POST /auth/login/{provider}`로 보내게 한다. `EXPO_PUBLIC_DEV_LOGIN_ID`가 있으면 개발 중에는 지금의 가짜 로그인을 그대로 쓴다.

**Architecture:** SDK 호출은 `src/session/social-credential.ts` 한 곳에만 둔다. 이 모듈은 토큰 문자열을 돌려주거나, 취소 오류·설정 누락 오류를 던진다. 세션 코드(`signIn`)는 바꾸지 않고, 로그인 화면이 취소 오류만 조용히 넘긴다. 네이티브 설정(번들 ID, 카카오 키, 구글 URL scheme)은 새 `app.config.ts`가 환경 변수로 채운다. 키가 없으면 해당 plugin을 빼서 가짜 로그인 모드와 CI가 키 없이 돈다.

**Tech Stack:** Expo SDK 58(`expo-dev-client`, config plugin), React Native 0.88, `@react-native-seoul/kakao-login` 6.x, `@react-native-google-signin/google-signin` 16.x(무료 원본 모듈, Firebase 없음), TypeScript 6, Jest 30 + `jest-expo` + RNTL 14(`render`·`fireEvent`는 async), Maestro.

**Spec:** `docs/superpowers/specs/2026-10-20-f-m01-social-login-design.md`

## Global Constraints

- iOS만. 번들 ID `com.altair.petgyebu`. 시뮬레이터 iPhone 18 Pro, iOS 27.0.
- 설치는 `npx expo install <pkg>`. `ios/`·`android/`는 생성물로 커밋하지 않고 손으로 고치지 않는다.
- 환경 변수(모두 공개 값, `.env.local`, 코드에 값 직접 쓰지 않음): `EXPO_PUBLIC_DEV_LOGIN_ID`, `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. 서버: `PETGYEBU_KAKAO_APP_ID`(숫자 앱 ID), `PETGYEBU_GOOGLE_CLIENT_IDS`(웹 클라이언트 ID).
- 전환 규칙: `__DEV__ && devLoginId` → `ok:<devLoginId>`. 그 밖에는 실제 SDK. `devLoginId`에 기본값을 두지 않는다.
- 카카오 credential은 `login()` 결과의 `accessToken`, 구글은 `signIn()` 성공 응답의 `data.idToken`.
- 문구: 버튼 "카카오 로그인", "Google로 로그인". 취소 시 문구 없음. 설정 누락은 `'지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.'`(서버 503과 같은 문구). 401·503·연결 오류는 기존 문구 그대로.
- 토큰, SDK 응답 전체, 키를 로그·오류 메시지에 넣지 않는다. 로그에는 오류 종류만 남긴다.
- 카카오 동의 항목은 추가로 요청하지 않는다. 구글은 기본 scope만 쓴다.
- 코드 작성 시 `.agents/skills/karpathy-guidelines/SKILL.md`를 따른다. Expo API는 SDK 58 문서(https://docs.expo.dev/versions/v58.0.0/)로 확인한다. lint 규칙을 끄지 않는다. 테스트는 `__tests__/`에 둔다.
- 커밋은 Conventional Commits 형식이고, 끝에 작성 모델의 `Co-Authored-By` 줄을 붙인다.
- 검사: `npm run lint`, `npm run typecheck`, `npm test`, `npx expo export --platform ios`.

## Review Focus

- 개발 빌드인데 `EXPO_PUBLIC_DEV_LOGIN_ID=`(빈 문자열) → 가짜 로그인이 아니라 실제 SDK를 연다(Task 2 테스트).
- 정식 빌드(`isDev=false`)에서 `devLoginId`가 있어도 → 실제 SDK를 연다(Task 2 테스트).
- 구글 `signIn()`은 성공했는데 `idToken`이 `null`(웹 클라이언트 ID 누락 등) → 빈 credential을 보내지 않고 설정 누락 오류(Task 2 테스트).
- 사용자가 로그인 창을 닫음 → 문구 없이 두 버튼이 다시 눌린다. 다음 탭에서 다시 시도된다(Task 3 테스트).
- 키 없는 `.env.local`로 `npx expo export`·`expo config` → 실패하지 않고 카카오·구글 plugin만 빠진다(Task 2 Step 6).

---

### Task 1: 개발용 앱으로 전환 (가짜 로그인 그대로)

**Files:**
- Create: `app.config.ts`
- Modify: `app.json`(`ios.bundleIdentifier: "com.altair.petgyebu"`), `package.json`(`"ios": "expo run:ios"`, `expo-dev-client`), `.maestro/subflows/open-app.yaml`, `.maestro/**/*.yaml`(`appId`·`APP_URL`), `README.md`(실행·Maestro 준비)

**Interfaces:**
- Produces: `app.config.ts` — `export default ({ config }: ConfigContext): ExpoConfig => ({ ...config })`. Task 2가 여기에 plugin을 조건부로 붙인다. 개발용 앱 appId는 `com.altair.petgyebu`.

- [ ] **Step 1:** `npx expo install expo-dev-client`, `app.json`에 번들 ID, `app.config.ts` 생성(지금은 `app.json`을 그대로 돌려줌), `ios` 스크립트 변경
- [ ] **Step 2:** `npx expo config --type public | grep bundleIdentifier` → `com.altair.petgyebu`
- [ ] **Step 3:** `npx expo run:ios`로 iPhone 18 Pro 시뮬레이터(`50D6091C-1336-43AC-8BEE-1E7093C75A9C`)에 설치. 앱이 로그인 화면까지 뜨는지 확인한다. 이때 백엔드는 `bootTestRun`, `.env.local`의 `EXPO_PUBLIC_DEV_LOGIN_ID`는 새 값이다.
- [ ] **Step 4:** `open-app.yaml`을 개발용 앱 기준으로 바꾼다. `appId: com.altair.petgyebu`, `stopApp` 뒤 개발용 앱 링크(`petgyebuapp://expo-development-client/?url=<encoded APP_URL>`)를 연다. 모든 시나리오의 `appId`와 기본 `APP_URL`(`http://127.0.0.1:8081`)도 바꾼다. 개발용 앱의 첫 실행 안내와 개발 메뉴가 화면을 가리면 `expo-dev-client` 문서(SDK 58)에서 끄는 방법을 찾아 적용한다.
- [ ] **Step 5:** `maestro test .maestro/onboarding/first-login.yaml`과 `.maestro/expenses/record-and-list.yaml`을 실행한다. 둘 다 통과해야 한다. 나머지 시나리오는 Task 3 Step 6에서 한꺼번에 돌린다.
- [ ] **Step 6:** README의 "실행"과 "시뮬레이터 자동 확인 → 준비"를 고친다. `npx expo run:ios`는 처음 한 번 하거나 네이티브 의존성이 바뀌었을 때 하고, 평소에는 `npx expo start --clear`로 띄운다. Expo Go 안내는 지운다.
- [ ] **Step 7:** `npm run lint && npm run typecheck && npm test && npx expo export --platform ios` → 모두 성공
- [ ] **Step 8: Commit** `chore: switch to an Expo development build for native login SDKs`

### Task 2: SDK 토큰을 credential로

**Files:**
- Modify: `src/config.ts`, `src/session/social-credential.ts`, `src/lib/error-message.ts`, `app.config.ts`, `.env.example`, `package.json`
- Test: `__tests__/social-credential-test.ts`, `__tests__/error-message-test.ts`, `__tests__/session-provider-test.tsx`(가짜 로그인 테스트가 `devLoginId` 모킹을 쓰도록)

**Interfaces:**
- Consumes: Task 1 `app.config.ts`
- Produces (`src/config.ts`):
  - `devLoginId: string | null` = `EXPO_PUBLIC_DEV_LOGIN_ID || null`
  - `googleIosClientId: string | null`, `googleWebClientId: string | null`(같은 방식)
- Produces (`src/session/social-credential.ts`):
  - `class SocialLoginCancelledError extends Error`: 사용자가 창을 닫음
  - `class SocialLoginUnavailableError extends Error`: 키 누락 또는 `idToken` 없음. 기존 `SocialLoginNotReadyError`를 대체한다.
  - `getSocialCredential(provider: Provider, isDev: boolean = __DEV__, devId: string | null = devLoginId): Promise<string>`
- `errorMessage(new SocialLoginUnavailableError(...))` → `'지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.'`

- [ ] **Step 1:** `npx expo install @react-native-seoul/kakao-login @react-native-google-signin/google-signin`. 카카오 라이브러리 소스(`node_modules/@react-native-seoul/kakao-login`)에서 사용자가 취소했을 때의 reject 코드를 찾아 Step 2 테스트에 그 값을 그대로 쓴다.
- [ ] **Step 2: 실패하는 테스트** (`jest.mock`으로 두 라이브러리 모킹)
  - `getSocialCredential('kakao', true, 'u1')` → `'ok:u1'`이고 SDK를 호출하지 않는다.
  - `getSocialCredential('kakao', true, null)`과 `('kakao', true, '')` → 카카오 `login`을 호출하고 `accessToken`을 돌려준다.
  - `getSocialCredential('google', false, 'u1')` → `GoogleSignin.signIn`을 호출하고 `data.idToken`을 돌려준다.
  - 카카오 `login`이 Step 1의 취소 코드로 reject → `SocialLoginCancelledError`
  - 구글 `signIn`이 `{ type: 'cancelled', data: null }` → `SocialLoginCancelledError`
  - 구글 성공인데 `data.idToken === null` → `SocialLoginUnavailableError`
  - 구글 클라이언트 ID 모킹이 `null` → `SocialLoginUnavailableError`이고 `signIn`을 호출하지 않는다.
  - 카카오 `login`이 다른 오류로 reject → 그 오류를 그대로 다시 던진다(오류 메시지에 토큰이 없다).
  - error-message: `SocialLoginUnavailableError` → 위 문구. `NotReady` 테스트는 지운다.
- [ ] **Step 3:** `npx jest __tests__/social-credential-test.ts __tests__/error-message-test.ts` → FAIL
- [ ] **Step 4: 구현**
  - `GoogleSignin.configure({ iosClientId, webClientId })`는 구글 경로에서 `signIn` 직전에 매번 호출한다(호출 비용이 작다).
  - `app.config.ts`는 `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`가 있을 때만 `['@react-native-seoul/kakao-login', { kakaoAppKey }]`를 넣는다.
  - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`가 있을 때만 `['@react-native-google-signin/google-signin', { iosUrlScheme }]`를 넣는다. `iosUrlScheme`은 `'<prefix>.apps.googleusercontent.com'`을 뒤집은 `'com.googleusercontent.apps.<prefix>'`다.
  - `.env.example`에 새 변수 세 개를 빈 값으로 넣고, 주석으로 "DEV_LOGIN_ID를 비우면 실제 로그인"을 적는다.
- [ ] **Step 5:** 같은 명령과 `npm test` → PASS
- [ ] **Step 6:** 키 없는 `.env.local`로 `npx expo config --type public`을 실행하면 plugin 목록에 두 라이브러리가 없다. 임시로 가짜 키를 넣으면 두 plugin과 URL scheme이 들어간다. 확인한 뒤 가짜 키를 지운다.
- [ ] **Step 7:** `npx expo run:ios`가 키 없이 빌드·실행된다. 새 아키텍처나 React Native 0.88에서 빌드가 실패하면 대안 라이브러리를 고르기 전에 멈추고 보고한다. `bootTestRun`으로 `maestro test .maestro/onboarding/first-login.yaml`(새 ID)을 실행해 통과해야 한다.
- [ ] **Step 8:** lint·typecheck·test·export → 성공
- [ ] **Step 9: Commit** `feat: get Kakao and Google credentials from the native SDKs (F-M01)`

### Task 3: 공식 로그인 버튼과 취소 처리

**Files:**
- Create: `src/components/social-login-button.tsx`, `assets/images/kakao-symbol.png`, `assets/images/google-g.png`(카카오·구글 공식 배포 리소스. 출처 URL을 커밋 메시지에 적는다)
- Modify: `src/app/sign-in.tsx`, `.maestro/**/*.yaml`(버튼 문구 6곳)
- Test: `__tests__/sign-in-screen-test.tsx`

**Interfaces:**
- Consumes: Task 2 `SocialLoginCancelledError`
- Produces: `SocialLoginButton({ provider: Provider; onPress: () => void; loading: boolean; disabled: boolean })`. 접근성 role `button`, 접근성 이름은 버튼 문구와 같다.

- [ ] **Step 1: 실패하는 테스트**(기존 두 테스트는 문구를 "카카오 로그인"으로 바꾼다)
  - `mockSignIn`이 `SocialLoginCancelledError`로 reject → 오류 문구가 없다(`queryByText` 기준 세 문구 모두 null). "카카오 로그인"·"Google로 로그인" 버튼이 다시 활성이다. 다시 누르면 `mockSignIn`이 두 번째로 호출된다.
  - `mockSignIn`이 `ApiError(503, 'SOCIAL_LOGIN_UNAVAILABLE')`로 reject → `'지금은 로그인할 수 없어요. 잠시 후 다시 시도해 주세요.'`
  - "Google로 로그인"을 누르면 `mockSignIn('google')`이 호출된다.
- [ ] **Step 2:** `npx jest __tests__/sign-in-screen-test.tsx` → FAIL
- [ ] **Step 3: 구현**
  - 카카오 버튼: 배경 `#FEE500`, 심볼은 검정 `#000000`, 문구는 `rgba(0,0,0,0.85)`, 모서리 12, 높이는 지금 `Button`과 같은 52.
  - 구글 버튼: 흰 배경, 테두리 `#747775`, 문구 `#1F1F1F`, G 로고 왼쪽.
  - 로딩은 `ActivityIndicator`이고 문구 색을 따른다.
  - `sign-in.tsx`는 `SocialLoginCancelledError`일 때 `setPending(null)`만 하고 오류를 띄우지 않는다.
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** `.maestro`의 "카카오로 시작하기"를 "카카오 로그인"으로 바꾼다.
- [ ] **Step 6:** `bootTestRun`과 가짜 로그인 모드로 README 표의 모든 시나리오를 준비 조건대로 실행한다. 모두 통과해야 한다. 로그인 화면 스크린샷(`xcrun simctl io booted screenshot`)으로 두 버튼 모양을 확인한다.
- [ ] **Step 7:** lint·typecheck·test·export → 성공
- [ ] **Step 8: Commit** `feat: use the official Kakao and Google sign-in buttons (F-M01)`

### Task 4: 콘솔 등록과 실제 로그인 확인 (사용자와 함께)

**Files:**
- Modify: `README.md`("실제 로그인 확인" 절: 필요한 키, `.env.local`, 백엔드 `bootRun` 환경 변수, 구글 테스트 사용자), `docs/api-spec.md`(필요하면 실제 응답과 다른 점)

- [ ] **Step 1:** 사용자에게 콘솔 등록을 단계별로 안내하고, 사용자가 진행하는 동안 기다린다.
  - 카카오 개발자 콘솔: 애플리케이션 추가 → 앱 설정 > 플랫폼 > iOS에 번들 ID `com.altair.petgyebu` → 카카오 로그인 활성화 → 네이티브 앱 키와 앱 ID 확인
  - 구글 클라우드: 프로젝트 생성 → OAuth 동의 화면(외부, 테스트 상태, 본인 계정을 테스트 사용자로 추가) → OAuth 클라이언트 "iOS"(번들 ID)와 "웹 애플리케이션" 생성 → 두 클라이언트 ID 확인
- [ ] **Step 2:** 사용자가 `.env.local`에 키 세 개를 넣고 `EXPO_PUBLIC_DEV_LOGIN_ID`를 비운다. 키를 받아 대화나 커밋에 남기지 않는다. 이어서 `npx expo run:ios`로 다시 빌드한다(plugin 반영).
- [ ] **Step 3:** 백엔드 `PETGYEBU_KAKAO_APP_ID=<앱 ID> PETGYEBU_GOOGLE_CLIENT_IDS=<웹 클라이언트 ID> ./gradlew bootRun`을 실행한다(`PETGYEBU_JWT_SECRET` 등 기존 필수 값은 백엔드 README대로). 이때 `bootTestRun`은 멈춘다.
- [ ] **Step 4:** 시뮬레이터에서 손으로 확인하고 결과를 기록한다.
  - 카카오 로그인 → 카카오 계정 웹 로그인 → 펫 선택 화면
  - 앱을 다시 실행하면 로그인 없이 같은 단계로 들어간다
  - 구글 로그인 → 펫 선택 화면(카카오와 별개 계정)
  - 각 로그인 창을 닫으면 문구 없이 로그인 화면에 머문다
  - 구글 ID 토큰의 `aud`가 웹 클라이언트 ID인지 확인한다. 서버가 200을 주면 확인된 것이다. 401이면 `aud`를 디코드해 보고한다.
- [ ] **Step 5:** README를 정리한다. `.env.local`을 가짜 로그인 모드로 되돌리고 `maestro test .maestro/onboarding/first-login.yaml`이 통과하는지 다시 확인한다.
- [ ] **Step 6:** lint·typecheck·test·export → 성공
- [ ] **Step 7: Commit** `docs: describe the real Kakao/Google login check`
- [ ] **Step 8:** PR(`develop` 대상). 제목은 `feat: sign in with real Kakao and Google accounts (F-M01)`. 기능 ID, 사용한 API(`POST /auth/login/{provider}`), 백엔드 커밋(`f1a3a83`), 확인한 기기, Task 3·4의 실제 실행 결과, 남은 제한(Android 미확인, SDK 로그아웃은 설정 화면 작업)을 적는다.
