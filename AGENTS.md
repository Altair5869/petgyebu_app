This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Petgyebu 작업 규칙

### 문서 기준
- 작업 전 `docs/00-renewal-development-guide.md`를 먼저 읽는다. 문서끼리 충돌하면 이 문서를 따른다.
- 그다음 작업할 기능에 해당하는 부분만 확인한다: `docs/01-prd.md`, `docs/02-requirements-features.md`, `docs/03-user-flow.md`, `docs/api-spec.md`.
- API를 연결할 때는 `docs/api-spec.md`와 실제 백엔드 응답을 대조한다. 둘이 다르면 그 차이를 보고한다.

### MVP 범위
- 카카오·구글 로그인
- 필수 펫 선택과 현재 월 예산 설정
- 직접 지출 기록
- 현재 월 펫 상태
- 월별 통계
- 범위 밖: 과거 Flutter 설계와 계좌 연동 설계는 가져오지 않는다.

### 작업 방식
- 한 번에 사용자 흐름 하나만 구현한다.
- 완료 전에 `npx expo lint`, `npx tsc --noEmit`을 통과시키고 그 흐름이 실제 앱에서 동작하는지 확인한다.

### 보안
- API 주소와 비밀값을 코드에 직접 쓰지 않는다. 환경 변수(`EXPO_PUBLIC_*`)나 앱 설정에서 가져온다. `EXPO_PUBLIC_*` 값은 앱 번들에 포함되므로 비밀값을 넣지 않는다.
- 인증 토큰은 로그, 에러 메시지, 콘솔 출력에 남기지 않는다.
