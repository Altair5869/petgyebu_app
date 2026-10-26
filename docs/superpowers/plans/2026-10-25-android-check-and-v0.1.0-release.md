# 안드로이드 확인과 v0.1.0 출시 실행 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 안드로이드 에뮬레이터에서 실제 로그인을 포함한 핵심 흐름을 확인하고, 앱·백엔드 출시 후보를 각 `main`에 병합해 `v0.1.0` 태그를 남긴다.

**Architecture:** 코드 변경은 작은 PR 셋(앱 안드로이드 로그인·버전, 백엔드 버전, 필요하면 Maestro 수정)뿐이다. 나머지는 환경 설치, 출시 후보 고정, 두 플랫폼 확인, 출시 PR·태그 절차다.

**Tech Stack:** Expo SDK 58 (CNG, dev build), `@react-native-seoul/kakao-login`, `@react-native-google-signin/google-signin`, Maestro, Spring Boot(Gradle), GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-10-25-android-check-and-v0.1.0-release-design.md`

## Global Constraints

- 안드로이드 패키지 이름: `com.altair.petgyebu`
- 버전: 앱 `app.json` `expo.version` = `0.1.0`, 백엔드 `build.gradle` `version` = `0.1.0`, 태그 `v0.1.0`(두 저장소)
- `android/`·`ios/`는 생성물이다. 손으로 고치거나 커밋하지 않는다(`.gitignore`에 `android/`가 없으면 Task 2에서 추가).
- 비밀값·`.env.local`·키스토어를 커밋하지 않는다. `.env.local` 수정은 사용자에게 묻고 한다.
- 에뮬레이터에서 호스트 백엔드 주소는 `http://10.0.2.2:8080/api/v1`.
- 디스크 여유 약 18GB. 설치 중 여유가 3GB 아래로 내려가면 멈추고 사용자에게 알린다.
- 작업 PR은 `develop`에 squash merge, 출시 PR은 `main`에 일반 merge commit. 실행한 검사만 PR에 적는다.
- 출시 후보 고정(Task 5) 뒤에는 두 저장소 `develop`에 다른 PR을 병합하지 않는다.

## Review Focus

1. 안드로이드에 `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`가 없더라도 구글 로그인이 거부되지 않아야 한다. iOS는 여전히 iOS 클라이언트 ID를 요구한다 → Task 2 테스트.
2. 안드로이드 하드웨어 뒤로 가기: 온보딩·지출 입력·회원 탈퇴 진행 중 뒤로 가기가 iOS 스와이프 잠금과 같은 결과를 내야 한다 → Task 6 수동 확인 목록.
3. 카카오톡 미설치 에뮬레이터에서 카카오 로그인은 카카오계정 웹 로그인으로 넘어가야 하고, 취소하면 오류 대신 조용히 로그인 화면에 남아야 한다(안드로이드 SDK의 취소 오류 형태는 iOS와 다를 수 있음) → Task 2 확인 후 필요하면 테스트 추가.
4. 숫자 키패드가 지출 저장 버튼을 가리지 않아야 한다(#23은 iOS KAV 기준으로 고쳤다) → Task 4 Maestro와 Task 6 수동 확인.
5. 에뮬레이터 앱이 `localhost`가 아니라 `10.0.2.2` 백엔드에 붙어야 한다. 잘못 붙으면 10초 타임아웃 오류가 난다 → Task 1 완료 기준.

---

### Task 1: 안드로이드 개발 환경 (커밋 없음)

**결정(내 판단):** 용량을 아끼려고 Android Studio 앱 대신 Homebrew `android-commandlinetools`로 SDK만 설치한다. 스펙은 설치 방식을 빌더에게 맡겼다. RN Gradle은 JDK 17을 쓰므로 `zulu@17`을 추가한다(현재 JDK 25만 있음).

- [ ] **Step 1:** `brew install --cask android-commandlinetools zulu@17`. `~/.zshrc`에 `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools`, `JAVA_HOME=$(/usr/libexec/java_home -v 17)`, `PATH`에 `$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator`를 추가한다(사용자 셸 파일이므로 추가 전에 알린다).
- [ ] **Step 2:** `sdkmanager --licenses` 동의 후 `sdkmanager "platform-tools" "emulator" "platforms;android-36" "build-tools;36.0.0" "system-images;android-36;google_apis_playstore;arm64-v8a"`. API 레벨은 Expo SDK 58 문서의 `compileSdkVersion`을 확인하고 맞춘다.
- [ ] **Step 3:** `avdmanager create avd -n petgyebu -k "system-images;android-36;google_apis_playstore;arm64-v8a" -d pixel_8` 실행 후 `emulator -avd petgyebu &`.
  확인: `adb devices`에 `emulator-5554 device`.
- [ ] **Step 4:** `.env.local`의 `EXPO_PUBLIC_API_BASE_URL`을 안드로이드용으로 바꿀지 사용자에게 묻는다(iOS와 동시에 쓰려면 실행 때마다 바꾸거나 `adb reverse tcp:8080 tcp:8080`으로 `localhost`를 유지한다. `adb reverse`를 우선 시도한다).
- [ ] **Step 5:** `bootTestRun`을 켜고 `npx expo run:android`를 실행한다.
  확인: 개발 빌드가 설치되고, 가짜 로그인 → 홈까지 진입(Review Focus 5). `df -h /` 여유를 기록한다.

### Task 2: 안드로이드 로그인 준비와 앱 버전 (`chore/android-login`)

**Files:**
- Modify: `app.json` (`expo.version`, `expo.android.package`)
- Modify: `src/session/social-credential.ts` (`googleCredential`, `restoreGoogleSession`의 iOS 클라이언트 ID 조건)
- Modify: `app.config.ts` (카카오 플러그인이 안드로이드를 구성하지 못할 때만)
- Modify: `README.md` (로그인 설정 표, 앱 빌드, 안드로이드 실행)
- Test: `__tests__/`의 기존 social-credential 테스트 파일(`grep -l getSocialCredential __tests__`)
- Add: 이 스펙과 계획 문서

**Interfaces:**
- Produces: `hasGoogleClientIds(os: string = Platform.OS): boolean`. `src/session/social-credential.ts`에서 export하며, `googleWebClientId`가 있고, `os === 'ios'`면 `googleIosClientId`도 있어야 true다.

- [ ] **Step 1:** 최신 `develop`에서 `chore/android-login` 브랜치를 만든다.
- [ ] **Step 2: 실패하는 테스트 작성.** config 모듈을 모킹해 다음을 확인한다:
  - `hasGoogleClientIds('android')`: 웹 ID만 있으면 `true`
  - `hasGoogleClientIds('ios')`: 웹 ID만 있으면 `false`
  - `hasGoogleClientIds('ios')`: 둘 다 있으면 `true`
  - 두 플랫폼 모두 웹 ID가 없으면 `false`
- [ ] **Step 3:** `npx jest <파일>`을 실행한다. 기대: FAIL(`hasGoogleClientIds` 없음).
- [ ] **Step 4: 구현.** `hasGoogleClientIds`를 구현하고, `googleCredential`과 `restoreGoogleSession`의 조건을 이것으로 바꾼다. `configure`에는 `iosClientId: googleIosClientId ?? undefined`를 넘긴다.
- [ ] **Step 5:** `npm test`를 실행한다. 기대: PASS.
- [ ] **Step 6: `app.json` 수정.** `"version": "0.1.0"`, `"android": { ..., "package": "com.altair.petgyebu" }`. `.gitignore`에 `/android`가 있는지 확인한다.
- [ ] **Step 7: 카카오 플러그인 확인.** `node_modules/@react-native-seoul/kakao-login/plugins`를 읽어 안드로이드 매니페스트(키·리다이렉트 액티비티)와 Gradle 저장소를 구성하는지 본다. 그다음 `npx expo prebuild --platform android --clean`을 실행하고 `android/app/src/main/AndroidManifest.xml`에 `kakao<키>` 스킴이 들어갔는지 확인한다. 부족하면 플러그인 옵션(`kotlinVersion` 등)으로만 채운다.
- [ ] **Step 8: 콘솔에 등록할 값 추출.**
  - 디버그 키스토어(`android/app/debug.keystore` 또는 `~/.android/debug.keystore`, 실제로 서명에 쓰는 쪽)에서 `keytool -list -v -keystore <path> -alias androiddebugkey -storepass android -keypass android`로 SHA-1을 뽑는다.
  - 같은 키스토어로 `keytool -exportcert ... | openssl sha1 -binary | openssl base64`를 실행해 카카오 키 해시를 뽑는다.
  - 패키지 이름과 함께 사용자에게 건네고 기다린다. 구글 클라우드에는 OAuth 클라이언트 "Android"(같은 프로젝트), 카카오 콘솔에는 플랫폼 Android(패키지명 + 키 해시)를 등록한다.
- [ ] **Step 9: 실제 로그인 사전 확인.**
  - 사용자에게 묻고 `.env.local`의 `EXPO_PUBLIC_DEV_LOGIN_ID`를 비운다.
  - 백엔드를 `bootRun` + 실제 검증 변수로 띄우고 `npx expo run:android`를 실행한다.
  - 사용자가 카카오·구글 로그인 → 홈 진입을 확인한다.
  - 카카오 로그인 창에서 취소했을 때 오류 문구가 뜨면, 안드로이드 취소 오류 형태를 `isKakaoCancel`에 추가하고 테스트를 추가한다(Review Focus 3).
  - 구글이 `DEVELOPER_ERROR`를 내면 SHA-1·패키지 등록을 재확인한다.
- [ ] **Step 10: README 갱신.**
  - 로그인 설정 표에 안드로이드 등록 항목(패키지명, SHA-1, 키 해시)을 넣는다.
  - 빌드 안내에 `npx expo prebuild --platform android --clean` → `npx expo run:android`를 넣는다.
  - 에뮬레이터 주소(`adb reverse` 또는 `10.0.2.2`)를 적는다.
- [ ] **Step 11:** `npm run lint && npm run typecheck && npm test`가 모두 통과하는지 확인한다.
- [ ] **Step 12: 커밋.** `git add app.json src/session/social-credential.ts __tests__/<파일> README.md docs/superpowers` (`app.config.ts`는 바꿨을 때만)로 스테이징하고 `chore: prepare Android login and set version 0.1.0`으로 커밋한다.
- [ ] **Step 13: 검토와 병합.**
  - app-qa에 검토를 맡기고 지적을 반영한다.
  - push 후 PR을 연다. 본문에는 확인한 기기(Android 에뮬레이터 API 36)와 실제 로그인 결과를 적는다.
  - CI가 통과하면 squash merge한다.

### Task 3: 백엔드 버전 (`chore/version-0.1.0`, `~/Desktop/petgyebu_backend_renewal`)

- [ ] **Step 1:** 최신 `develop`에서 브랜치를 만들고 `build.gradle:8`을 `version = '0.1.0'`으로 바꾼다.
- [ ] **Step 2:** `./gradlew test --no-daemon`을 실행한다. 기대: BUILD SUCCESSFUL.
- [ ] **Step 3:** `chore: set version 0.1.0`으로 커밋하고 push, PR을 연다. CI가 통과하면 squash merge한다.

### Task 4: Maestro 안드로이드 사전 실행과 수정 (`fix/maestro-android`, 필요할 때만)

**Files:** `.maestro/**`, README의 "시뮬레이터 자동 확인" 절

- [ ] **Step 1:** `bootTestRun`과 에뮬레이터 개발 빌드(`EXPO_PUBLIC_DEV_LOGIN_ID` 사용)를 띄우고, README 순서대로 `.maestro/` 흐름 전부를 실행한다. 새 첫 로그인 계정이 필요한 흐름은 README 절차를 따른다. 흐름별 통과·실패를 표로 기록한다.
- [ ] **Step 2: 실패 분류.**
  - 앱 문제: 사용자와 상의한다(스펙 "확인 중 문제").
  - 시나리오 문제: 안드로이드에서 다른 접근성 이름·날짜 선택기·키보드 닫기 등이 원인이다.
  - 전부 통과하면 Step 3~5를 건너뛴다.
- [ ] **Step 3: 시나리오 수정.**
  - 두 플랫폼 공통 선택자(가능하면 `testID`/접근성 라벨)로 고친다.
  - 불가피하면 `runFlow: when: platform: Android`로 분기한다.
  - 앱 코드에 `testID`를 추가해야 하면 이 PR에 포함한다.
  - 하드코딩된 `APP_URL`은 `${APP_URL || ...}` 형식으로 통일한다. 안드로이드 개발 빌드 URL이 다르기 때문이다.
- [ ] **Step 4:** 고친 흐름을 안드로이드와 iOS 시뮬레이터 모두에서 다시 실행한다. 기대: 두 플랫폼 모두 통과.
- [ ] **Step 5: 마무리.**
  - README에 안드로이드 Maestro 실행 방법을 추가한다.
  - lint·typecheck·test를 실행한다.
  - app-qa 검토를 받고, `fix: make Maestro flows pass on Android`로 PR을 연다. 본문에 두 플랫폼 실행 표를 넣는다.
  - CI가 통과하면 squash merge한다.

### Task 5: 출시 후보 고정

- [ ] **Step 1:** 두 저장소에서 `git switch develop && git pull`을 실행하고 `git rev-parse --short HEAD`를 기록한다. 앱 `<A>`, 백엔드 `<B>`라고 한다.
- [ ] **Step 2:** 열린 PR이 있으면 사용자에게 알리고, 확인이 끝날 때까지 병합하지 않는다고 기록한다.
- [ ] **Step 3:** 백엔드 `<B>`에서 `./gradlew test --no-daemon`을 실행한다. 기대: 성공.
- [ ] **Step 4:** 앱 `<A>`에서 `npm run lint && npm run typecheck && npm test`를 실행한다. 기대: 성공.

### Task 6: 두 플랫폼 확인 (커밋 `<A>`, `<B>`)

- [ ] **Step 1:** iOS 시뮬레이터에서 `.maestro/` 흐름 전부를 실행한다(`bootTestRun`, `prebuild --platform ios --clean` 후 `run:ios`). 흐름별 결과를 기록한다.
- [ ] **Step 2:** 안드로이드 에뮬레이터에서도 같은 흐름 전부를 실행하고 결과를 기록한다.
- [ ] **Step 3:** 실제 로그인 확인. 백엔드는 `bootRun` + 실제 검증 변수로 띄우고, 사용자가 직접 조작한다.
  - iOS: 카카오 로그인 → 홈 → 로그아웃, 구글도 같은 순서
  - 안드로이드: 같은 흐름에, 카카오나 구글 중 하나로 회원 탈퇴까지
- [ ] **Step 4: 안드로이드 수동 확인 목록(Review Focus 2·4).**
  - 펫·예산 화면과 지출 입력 중 하드웨어 뒤로 가기
  - 회원 탈퇴 진행 중 뒤로 가기
  - 숫자 키패드가 저장 버튼을 가리지 않는지
  - 홈 펫 깜빡임과 쓰다듬기
- [ ] **Step 5:** 새로 실패한 항목이 있으면 스펙 "확인 중 문제"를 따른다. 고치면 Task 5부터 다시 시작한다.

### Task 7: 출시 PR과 태그

- [ ] **Step 1: 백엔드 출시 PR.**
  - `gh pr create --base main --head develop --title "release: v0.1.0"`로 연다.
  - 본문에는 포함 기능(F-M01~F-M06), `./gradlew test` 결과, 앱 확인 결과 요약, 앱 고정 커밋 `<A>`, 알려진 제한(`project-mvp-progress`의 deferred 항목)을 적는다.
  - CI가 통과하면 `gh pr merge --merge`로 병합한다.
- [ ] **Step 2: 백엔드 태그와 `develop` 반영.**
  - `git switch main && git pull && git tag -a v0.1.0 -m "v0.1.0" && git push origin v0.1.0`
  - `git switch develop && git merge --ff-only main || git merge main`을 실행하고 push한다.
  - 사용자 요청이 있으므로 `develop` 직접 push를 허용한다. 이것은 docs/07의 "main을 develop에 반영"에 해당한다.
- [ ] **Step 3: 앱 출시 PR.** Step 1과 같은 방식으로 연다. 본문에는 다음을 적는다:
  - iOS·안드로이드 Maestro 표
  - 실제 로그인 결과
  - 수동 확인 목록
  - 백엔드 태그 `v0.1.0` 커밋
  - 확인하지 않은 것: 실기기, VoiceOver·TalkBack, 운영 백엔드
- [ ] **Step 4:** 앱 저장소에서도 Step 2처럼 태그를 달고 `develop`에 반영한다.
- [ ] **Step 5: 기록.** `git ls-remote --tags origin`으로 두 저장소에 `v0.1.0`이 있는지 확인하고, 메모리 `project-mvp-progress`를 갱신한다.
