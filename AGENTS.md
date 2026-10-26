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
- 한 번에 사용자 흐름 하나만 구현한다. 시작 전에 그 흐름의 완료 기준과 필요한 API를 정한다.
- 코드 작성·수정·리뷰 시 `.agents/skills/karpathy-guidelines/SKILL.md`를 반드시 적용한다.
- 역할을 나눌 때 `app-engineer`가 구현하고 `app-qa`가 완료된 변경을 독립 검토한다(Codex: `.codex/agents/`, Claude Code: `.claude/agents/`). 같은 파일을 동시에 수정하지 않는다.

### 검증
- 토큰 갱신, 화면 진입 분기, 입력 검증, 금액·사용률 표시처럼 틀리기 쉬운 로직에는 의미 있는 Jest 테스트를 추가한다. 테스트는 `__tests__/`에 둔다.
- 완료 전에 `npm run lint`, `npm run typecheck`, `npm test`를 실행해 통과시킨다. CI(`.github/workflows/ci.yml`)도 모든 push·PR에서 같은 검사를 실행한다.
- 사용자 흐름을 바꿨다면 iOS 시뮬레이터에서 `bootTestRun` 백엔드와 연결해 실제로 확인한다. 실행하지 않은 검사나 기기 확인을 완료했다고 보고하지 않는다.
- 시뮬레이터 확인은 `.maestro/`의 Maestro 시나리오로 자동화한다. 흐름을 추가·변경하면 해당 시나리오도 추가·수정하고 실행 결과를 PR에 적는다(실행 방법은 README).

### 보안
- API 주소와 비밀값을 코드에 직접 쓰지 않는다. 환경 변수(`EXPO_PUBLIC_*`)나 앱 설정에서 가져온다. `EXPO_PUBLIC_*` 값은 앱 번들에 포함되므로 비밀값을 넣지 않는다.
- 인증 토큰은 로그, 에러 메시지, 콘솔 출력에 남기지 않는다.

### 브랜치·PR
- 브랜치 생성·PR·병합·출시 전에 `docs/07-branch-strategy.md`를 읽고 따른다.
- `main`·`develop`에 직접 커밋하지 않는다. 최신 `develop`에서 `feature/{F-ID}-{slug}`, `fix/{slug}`, `chore/{slug}`, `docs/{slug}` 브랜치를 만들고 `develop`으로 PR을 보낸다.
- 커밋과 PR 제목은 Conventional Commits 형식을 쓴다. PR에는 기능 ID, 사용한 API, 확인한 기기, 실제로 실행한 검사 결과를 적는다.
- 작업 PR은 `develop`에 squash merge하고, 출시 PR만 `develop` → `main` 일반 merge commit으로 병합한다.
