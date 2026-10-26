# F-M01 카카오·구글 실제 로그인 설계: 개발용 앱 전환 → SDK 토큰 → 기존 로그인 API

- 작성일: 2026-10-20
- 브랜치: `feature/F-M01-social-login`
- 관련 기능: F-M01(로그인·온보딩) 중 실제 소셜 로그인
- 기준 문서: `docs/00-renewal-development-guide.md`(우선) 인증 절, `docs/api-spec.md` 인증 API
- 이전 작업: `2026-10-18-f-m01-app-onboarding-design.md`(가짜 로그인으로 온보딩 흐름 완성)
- 백엔드: `petgyebu_backend_renewal` PR #23(카카오·구글 토큰 검증, 병합됨), PR #25(credential 4,096자 제한)

## 1. 목표와 범위

로그인 화면의 카카오·구글 버튼을 누르면 실제 계정으로 로그인한다. 앱은 공급자 SDK가 준 토큰을 이미 완성된 `POST /auth/login/{provider}`에 `credential`로 보내고, 그 뒤는 지금과 같다(펫 없음 → 펫 선택, 예산 없음 → 예산 설정, 둘 다 있음 → 홈).

**포함**

- Expo Go에서 개발용 앱(development build, `expo-dev-client`)으로 개발 방식 전환(사용자 결정)
- 카카오 SDK 로그인(카카오 액세스 토큰), 구글 Sign-In(ID 토큰)
- 공식 디자인 가이드를 따른 카카오·구글 로그인 버튼
- 환경 변수로 가짜 로그인과 실제 로그인 전환(사용자 결정, 3절)
- README 실행 방법과 Maestro 시나리오의 앱 실행 방식 갱신
- 카카오 개발자 콘솔·구글 클라우드 등록 안내(사용자는 아직 등록 전)

**제외**

- Android(사용자 결정). Android SHA-1·카카오 키 해시 등록과 Android 확인은 Android 확인 작업에서 한다. 단, 코드는 플랫폼 분기 없이 쓰고 config plugin의 Android 설정을 일부러 막지는 않는다
- 실제 휴대폰 확인. iOS 시뮬레이터로 충분하다(사용자 결정)
- 로그아웃·탈퇴 화면과 SDK 로그아웃 호출(다음 작업인 설정 화면에서)
- EAS 클라우드 빌드와 스토어 배포 설정. 이번에는 로컬 `npx expo run:ios`만 쓴다
- 백엔드 변경. 서버에는 환경 변수 두 개만 넣는다(2절)
- 앱인토스 토스 로그인(가이드 문서 기준 별도 설계)

**실패로 보는 것**

- 실제 로그인 후 백엔드가 401·503을 돌려주는데 원인을 알 수 없는 상태(앱 설정과 서버 설정 값이 어긋남)
- 정식 출시용 빌드(`__DEV__ === false`)에서 가짜 로그인 경로가 동작하는 것
- 사용자가 로그인 창을 닫았는데 오류 메시지가 뜨는 것
- 기존 Maestro 시나리오가 더 이상 돌지 않는 것
- 카카오·구글 토큰이나 서버 토큰이 로그·오류 메시지에 남는 것

## 2. 백엔드 확인 결과 (2026-10-20, 코드 확인)

`POST /auth/login/{provider}`는 `api-spec.md`와 일치한다. 요청 `{ "credential": "..." }`(최대 4,096자), 응답은 `accessToken`·`refreshToken`·`accessExpiresInSeconds`.

| 공급자 | 앱이 보낼 값 | 서버 검증 | 서버 설정 |
|---|---|---|---|
| 카카오 | 카카오 SDK `login()`의 `accessToken` | `GET kapi.kakao.com/v1/user/access_token_info`, 응답 `app_id`가 설정 값과 같아야 함 | `PETGYEBU_KAKAO_APP_ID`(카카오 콘솔의 숫자 **앱 ID**. 네이티브 앱 키와 다름) |
| 구글 | Google Sign-In `signIn()`의 `idToken` | 구글 JWKS로 서명·`iss`·`exp`, `aud`가 설정 목록 중 하나 | `PETGYEBU_GOOGLE_CLIENT_IDS`(쉼표 구분 목록) |

- 설정이 비어 있으면 그 공급자는 `503 SOCIAL_LOGIN_UNAVAILABLE`이다.
- `bootTestRun`(`LocalDevApplication`)은 `ok:<id>`를 받는 가짜 검증기를 쓴다. 실제 토큰은 `./gradlew bootRun`으로 확인한다. 백엔드 README 기준 `bootRun`은 실제 검증기를 쓰고 같은 로컬 Postgres를 자동으로 띄운다. 위 두 환경 변수를 넣어 실행한다. 백엔드 코드를 바꿔야 한다면 그 차이를 보고하고 별도 백엔드 PR로 다룬다.
- 구글 `aud`: `webClientId`를 지정하면 iOS에서 받는 ID 토큰의 `aud`는 웹 클라이언트 ID가 된다(구현 시 실제 토큰을 디코드해 확인). 서버의 `PETGYEBU_GOOGLE_CLIENT_IDS`에는 이 값을 넣는다.

## 3. 가짜 로그인과 실제 로그인 전환

- `__DEV__`이고 `EXPO_PUBLIC_DEV_LOGIN_ID`에 값이 있으면: 두 버튼 모두 지금처럼 `ok:<값>`을 보낸다. Maestro 시나리오는 이 상태로 돈다.
- 값이 없거나 비어 있으면: 실제 SDK를 연다.
- `__DEV__`가 아니면: 값과 관계없이 항상 실제 SDK를 쓴다.
- 지금 `src/config.ts`는 값이 없을 때 `'dev-user'`를 기본값으로 쓴다. 이 기본값을 없애 "값 없음 = 실제 로그인"이 되게 한다. `.env.example`과 README에 전환 방법(값을 지우고 Metro 재시작)을 적는다.
- `SocialLoginNotReadyError`와 "아직 준비 중인 로그인이에요." 문구는 더 이상 쓸 곳이 없으면 지운다.

## 4. 앱 설정과 키

| 값 | 쓰는 곳 | 공개 여부 |
|---|---|---|
| iOS 번들 ID | `ios.bundleIdentifier`, 카카오·구글 콘솔 등록 | 공개 |
| 카카오 네이티브 앱 키 | 카카오 config plugin(`kakaoAppKey`), URL scheme `kakao{키}` | 공개(앱에 포함됨) |
| 구글 iOS 클라이언트 ID | `GoogleSignin.configure({ iosClientId })`, config plugin `iosUrlScheme`(역순 클라이언트 ID) | 공개 |
| 구글 웹 클라이언트 ID | `GoogleSignin.configure({ webClientId })`, 서버 `PETGYEBU_GOOGLE_CLIENT_IDS` | 공개 |
| 카카오 앱 ID(숫자) | 서버 `PETGYEBU_KAKAO_APP_ID`만 | 공개 |

- 모두 공개 값이지만 저장소 규칙대로 코드에 직접 쓰지 않는다. 앱은 `EXPO_PUBLIC_*` 환경 변수에서 읽고, config plugin 값은 `app.json`을 `app.config.ts`로 옮기거나 `app.json`을 확장하는 `app.config.ts`에서 환경 변수로 채운다. 값이 없을 때 빌드를 실패시킬지, 버튼을 누를 때 안내할지는 구현자가 정한다(단, 가짜 로그인 모드에서는 키 없이도 빌드·실행돼야 한다. Maestro와 CI가 키 없이 돈다).
- **번들 ID는 `com.altair.petgyebu`다(사용자 확인).** 콘솔에 등록한 뒤에는 바꾸기 번거롭다.
- 작업 순서(사용자 결정): ① 가짜 로그인 모드로 개발용 앱 전환·SDK 연결·버튼·Maestro까지 만들고 확인 → ② 사용자가 안내에 따라 콘솔 등록 → ③ 실제 로그인 확인. PR은 ③까지 마친 뒤 병합한다.
- 콘솔 등록 절차(카카오: 애플리케이션 추가 → 플랫폼 iOS 번들 ID → 카카오 로그인 활성화. 구글: OAuth 동의 화면 → iOS 클라이언트·웹 클라이언트 생성)는 구현 첫 단계에서 사용자에게 단계별로 안내하고, 사용자가 받은 값을 `.env.local`과 서버 환경 변수에 넣는다. 카카오 로그인 동의 항목은 추가로 요청하지 않는다(서버는 회원 번호만 쓴다). 구글 OAuth 동의 화면은 테스트 상태로 두고 확인할 구글 계정을 테스트 사용자로 추가한다(내 결정).

## 5. 라이브러리 (구현자가 설치 전 SDK 58 호환을 다시 확인)

- `expo-dev-client`(58.x): 개발용 앱
- `@react-native-seoul/kakao-login`(6.x): Expo config plugin(`kakaoAppKey`) 제공, `login()`이 카카오톡이 없으면 카카오 계정 웹 로그인으로 넘어간다. 시뮬레이터에는 카카오톡이 없으므로 이 경로로 확인한다. React Native 0.88·새 아키텍처 동작은 설치 후 실제 빌드로 확인한다. 안 되면 대안을 찾기 전에 사용자에게 보고한다
- `@react-native-google-signin/google-signin`(16.x, 무료 원본 모듈): Firebase 없이 `iosUrlScheme` config plugin 사용. `signIn()` 응답 `type`이 `'cancelled'`이면 취소
- 설치는 `npx expo install`로 한다. `ios/`는 생성물이며 커밋하지 않는다(`.gitignore`에 이미 있음)

## 6. 화면과 동작

**로그인 화면**: 지금 구조(제목·부제·버튼 두 개·오류 문구)를 유지하고 버튼만 공식 디자인 가이드에 맞춘다.

- 카카오: 배경 `#FEE500`, 검은 말풍선 심볼, "카카오 로그인" 문구(카카오 디자인 가이드의 색·비율)
- 구글: 구글 브랜드 가이드의 "Google로 로그인" 버튼(흰 배경·테두리·G 로고)
- 로고는 공식 배포 이미지 또는 SVG를 `assets/`에 둔다
- 진행 중 표시와 중복 탭 방지는 지금처럼 유지(누른 버튼에 로딩, 둘 다 비활성)

**흐름**

1. 버튼 탭 → 해당 SDK 로그인 창
2. 성공 → 토큰을 `api.login(provider, credential)`로 전송 → 기존처럼 단계 판정 후 이동
3. 사용자가 창을 닫음(카카오 취소 오류, 구글 `cancelled`) → 아무 메시지 없이 로그인 화면에 머물고 버튼 다시 활성
4. SDK 오류(네트워크 등) → 기존 연결 오류 문구
5. 서버 401 `SOCIAL_LOGIN_FAILED`·503 `SOCIAL_LOGIN_UNAVAILABLE` → 기존 문구 그대로

- 카카오 SDK의 취소를 어떤 오류 코드로 구분하는지는 라이브러리를 설치해 실제로 확인한다.
- 로그에는 오류 종류만 남기고 토큰·SDK 응답 전체를 찍지 않는다.
- SDK 호출은 `src/session/social-credential.ts` 뒤에 두어 화면과 세션 코드가 SDK를 직접 알지 않게 한다(지금 구조 유지). 취소는 별도 오류 타입으로 바꿔 세션·화면이 구분할 수 있게 한다.

## 7. 개발 환경 변경

- 실행: `npx expo run:ios`로 개발용 앱을 시뮬레이터에 설치한 뒤 `npx expo start`(Expo Go 대신). `package.json`의 `ios` 스크립트도 맞춘다.
- Maestro: `subflows/open-app.yaml`의 `appId: host.exp.Exponent`와 `exp://` 링크를 개발용 앱의 번들 ID와 개발용 앱 링크(예: `petgyebuapp://expo-development-client/?url=…`)로 바꾼다. 개발용 앱의 시작 화면·개발 메뉴 안내를 건너뛰는 방법을 확인한다. 기존 시나리오는 모두 다시 실행해 통과를 확인한다.
- README의 실행·Maestro 준비 절차를 개발용 앱 기준으로 고친다.
- CI(`lint`·`typecheck`·`test`)는 네이티브 빌드를 하지 않으므로 그대로 둔다. 브랜치 전략 문서대로 `npx expo export --platform ios`도 확인한다.

## 8. 테스트와 검증

**Jest(`__tests__/`)**

- `social-credential`: 개발+ID 있음 → `ok:<id>`; 개발+ID 없음 → SDK 호출; 비개발 → ID가 있어도 SDK 호출; 카카오·구글 취소 → 취소 오류; SDK 성공 → 정확한 토큰 필드(카카오 `accessToken`, 구글 `idToken`) 반환. SDK는 모킹한다
- 로그인 화면: 취소 시 오류 문구 없음·버튼 다시 활성; 서버 401·503 문구
- 기존 `session-provider`·`sign-in-screen`·`error-message` 테스트를 바뀐 동작에 맞춘다

**시뮬레이터(iPhone 18 Pro, iOS 27.0)**

- 가짜 로그인 모드: 기존 Maestro 시나리오 전부를 개발용 앱으로 실행
- 실제 로그인 모드(실제 검증기로 띄운 백엔드): 카카오 계정 로그인 → 새 계정 펫 선택 화면; 구글 로그인 → 같은 흐름; 각 로그인 창 닫기 → 메시지 없음. 실제 계정 로그인은 Maestro로 자동화하지 않고 손으로 확인해 PR에 적는다
- 필수 검사: `npm run lint`, `npm run typecheck`, `npm test`, `npx expo export --platform ios`

## 9. 구현자에게 맡기는 것

- 카카오·구글 SDK 초기화 위치(`GoogleSignin.configure` 호출 시점)
- `app.config.ts` 구성 방식, 키가 없을 때의 처리(3·4절 조건 안에서)
- 버튼 컴포넌트 구조와 로고 파일 형식
- 개발용 앱 실행 링크와 Maestro 시작 화면 건너뛰기 방법
- 실제 검증기로 백엔드를 띄우는 구체 명령
