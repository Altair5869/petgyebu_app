# 안드로이드 확인과 v0.1.0 출시 설계

- 작성일: 2026-10-25
- 대상: `petgyebu_app`, `petgyebu_backend_renewal`
- 기준: `docs/07-branch-strategy.md` 5절(앱), 백엔드 `docs/07-branch-strategy.md` 5절

## 의도

MVP 기능(F-M01~F-M06)은 모두 앱 `develop`에 병합됐지만 iOS 시뮬레이터에서만 확인했다. `docs/07`은 출시 후보에서 iOS·안드로이드 핵심 흐름을 모두 확인하라고 한다. 이번 작업은 안드로이드에서도 앱이 실제로 동작함을 확인하고, 확인을 마친 앱·백엔드 커밋을 각 저장소의 `main`에 병합해 `v0.1.0` 태그를 남긴다. 그래야 이후 운영 배포·스토어 작업이 검증된 기준점에서 시작할 수 있다.

## 목표

1. 이 Mac에 Android Studio와 에뮬레이터를 설치한다(사용자 결정: 로컬 에뮬레이터).
2. 안드로이드에서 카카오·구글 **실제 로그인**이 되도록 앱 설정을 갖춘다(사용자 결정).
3. 앱 출시 후보 커밋과 백엔드 출시 후보 커밋을 고정하고, iOS·안드로이드에서 핵심 흐름을 확인한다.
4. 두 저장소 모두 `develop` → `main` 출시 PR을 일반 merge commit으로 병합하고 `v0.1.0` 태그를 단 뒤, `main`을 `develop`에 다시 반영한다(사용자 결정: 백엔드도 동일).

## 범위 밖

- 스토어 제출, EAS 운영 빌드, 아이콘·스크린샷·개인정보처리방침
- 운영 백엔드 배포와 운영 API 주소
- 구글 OAuth 동의 화면 게시, 카카오 운영(비즈) 설정: 일반 사용자에게 로그인을 여는 단계라 스토어 출시와 함께 한다. 이번 확인은 테스트 사용자·팀원으로 등록된 본인 계정으로 한다.
- 실제 아이폰·안드로이드 실기기 확인, VoiceOver·TalkBack 청취
- 새 기능이나 디자인 변경

## 실패로 볼 것

- 실행하지 않은 확인을 출시 PR에 확인했다고 적는 것
- 확인한 커밋과 `main`에 병합한 커밋이 다른 것(검증 중 `develop`에 다른 PR이 들어가는 것)
- 비밀값(카카오 앱 키, 클라이언트 ID 외 비밀, JWT secret, 키스토어 비밀번호)을 저장소에 커밋하는 것
- `android/` 디렉터리를 손으로 편집하거나 커밋하는 것(CNG; `ios/`처럼 생성물로 둔다)

## 제약

- 디스크 여유 약 18GB. Android Studio + SDK + 시스템 이미지 하나로 끝내야 한다. 시스템 이미지는 Apple Silicon용 arm64 하나만, Google Play 포함 이미지로 받는다(구글 로그인에 Play 서비스가 필요하다). 설치 중 공간이 부족하면 멈추고 사용자에게 알린다.
- Expo SDK 58. Expo·RN API는 버전 문서(`https://docs.expo.dev/versions/v58.0.0/`)로 확인한다.
- 카카오·구글 콘솔 등록은 사용자가 직접 한다. Claude는 등록할 값(패키지 이름, 디버그 키스토어 SHA-1, 카카오 키 해시)을 뽑아 건넨다.
- 앱 확인용 백엔드:
  - Maestro 흐름: `./gradlew bootTestRun`(가짜 로그인)
  - 실제 로그인: `bootRun` + `PETGYEBU_KAKAO_APP_ID`, `PETGYEBU_GOOGLE_CLIENT_IDS`(앱 `.env.local`의 값)
  - 안드로이드 에뮬레이터는 호스트를 `10.0.2.2`로 본다(README 표의 `http://10.0.2.2:8080/api/v1`).
- 실제 로그인 확인은 사용자가 시뮬레이터·에뮬레이터에서 직접 입력한다.

## 정한 방식

### 1. 안드로이드 개발 환경

Android Studio 설치 → SDK·플랫폼 도구·에뮬레이터 → Google Play arm64 시스템 이미지 하나로 AVD 생성. `adb`와 `emulator`가 셸에서 동작하고 `npx expo run:android`로 개발 빌드가 에뮬레이터에 설치되는 것까지가 완료 기준이다.

### 2. 안드로이드 로그인 준비 PR (`chore/android-login`, 앱 → `develop`)

- `app.json`의 `android.package`를 iOS 번들 ID와 같은 `com.altair.petgyebu`로 지정한다.
- 카카오: 이미 붙어 있는 `@react-native-seoul/kakao-login` 설정 플러그인이 안드로이드도 구성하는지 확인하고, 부족하면 `app.config.ts`에서 채운다.
- 구글: 안드로이드는 `webClientId`로 받은 ID 토큰의 `aud`가 웹 클라이언트 ID라서 백엔드 설정은 바뀌지 않을 것으로 본다(추측; 실제 로그인으로 확인). 다만 현재 `googleCredential`은 `googleIosClientId`가 없으면 거부하므로, 안드로이드에서 필요한 값만 요구하도록 고칠지 판단한다.
- 사용자에게 건넬 값: 패키지 이름, 디버그 키스토어 SHA-1(구글 "Android" OAuth 클라이언트용), 카카오 키 해시(카카오 콘솔 Android 플랫폼용).
- README의 로그인 설정 표와 빌드 안내에 안드로이드 항목을 추가한다.
- 플랫폼 분기 로직을 바꾸면 Jest 테스트를 추가한다. lint·typecheck·test 통과, app-qa 검토, CI 통과 후 squash merge.
- `app.json`의 `expo.version`을 `1.0.0`에서 `0.1.0`으로 바꾼다(사용자 결정: 태그와 버전 일치).
- 이 설계 문서도 이 PR에 함께 커밋한다.

### 2-1. 백엔드 버전 PR (`chore/version-0.1.0`, 백엔드 → `develop`)

`build.gradle`의 `version`을 `0.0.1-SNAPSHOT`에서 `0.1.0`으로 바꾼다(사용자 결정). `./gradlew test --no-daemon` 통과, CI 통과 후 squash merge.

### 2-2. Maestro 안드로이드 사전 실행과 시나리오 수정

출시 후보 고정 **전에** `.maestro/` 시나리오 전부를 안드로이드 에뮬레이터에서 한 번 돌린다. 앱은 정상인데 시나리오가 iOS 전용이라 실패하는 곳은 두 플랫폼에서 모두 통과하도록 고친다(사용자 결정: 기록만 하지 않고 고친다). 수정은 `fix/maestro-android` PR 하나로 모으고, iOS에서도 다시 통과함을 확인한 뒤 squash merge한다. 안드로이드에서만 나오는 앱 문제는 아래 "확인 중 문제"를 따른다.

### 3. 출시 후보 고정

2·2-1·2-2번 PR이 병합된 앱 `develop` 커밋과 백엔드 `develop` 커밋(2-1 병합 후)을 출시 후보로 적는다. 확인이 끝날 때까지 두 저장소 `develop`에 다른 PR을 병합하지 않는다. 확인 중 수정이 필요하면 아래 "확인 중 문제"를 따른다.

### 4. 두 플랫폼 확인

- 백엔드: 고정 커밋에서 `./gradlew test --no-daemon` 통과.
- 앱: 고정 커밋에서 `npm run lint`, `npm run typecheck`, `npm test` 통과.
- `.maestro/`의 기존 시나리오 전부를 iOS 시뮬레이터와 안드로이드 에뮬레이터에서 `bootTestRun`과 연결해 실행한다. README대로 일부 흐름은 새 첫 로그인 계정이 필요하다. 2-2를 거쳤으므로 고정 커밋에서는 두 플랫폼 모두 전부 통과해야 한다. 여기서 새로 실패하면 "확인 중 문제"를 따른다.
- 실제 로그인: iOS·안드로이드 각각 카카오·구글로 로그인 → 홈 진입, 로그아웃까지 사용자가 직접 확인한다. 회원 탈퇴(연결 해제)는 iOS에서 이미 확인했으므로 안드로이드에서 한 번 확인한다.

### 5. 출시 PR과 태그 (두 저장소 각각)

- 출시 PR `develop` → `main`. 본문: 포함 기능, iOS·안드로이드 확인 결과(실행한 것만), 상대 저장소의 고정 커밋, 알려진 제한.
- 일반 merge commit으로 병합 → `main`의 병합 커밋에 `v0.1.0` 주석 태그 → 원격에 푸시.
- `main`을 `develop`에 다시 반영(fast-forward가 안 되면 `main` → `develop` merge).
- 백엔드를 먼저 병합·태그하고 그 커밋을 앱 출시 PR에 적는다(앱이 백엔드 계약에 의존).

## 확인 중 문제

안드로이드에서만 나오는 문제가 생기면 그때 사용자와 상의해 출시 전에 고칠지, 알려진 제한으로 기록할지 정한다. 고친다면 `fix/{slug}` PR로 `develop`에 병합하고 출시 후보를 다시 고정한 뒤 영향받는 확인을 다시 실행한다.

## 빌더에게 맡기는 것

- Android Studio 설치 방식(공식 dmg 또는 Homebrew cask), AVD 기기 모델·API 레벨(Expo SDK 58이 지원하는 최신 안정 버전 권장)
- 키 해시·SHA-1을 뽑는 구체 명령
- Maestro 안드로이드 실행 방법을 README에 어떻게 적을지
- 출시 PR 본문 문장
