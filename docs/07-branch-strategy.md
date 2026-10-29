# 브랜치·PR 전략: Petgyebu React Native 앱

- 기준일: 2026-10-18
- 대상: `petgyebu_app` 저장소(Expo / React Native)
- 제품·API 기준: `docs/00-renewal-development-guide.md`, `docs/api-spec.md`
- 백엔드 연계: `petgyebu_backend_renewal/docs/07-branch-strategy.md`

## 1. 브랜치 역할

| 브랜치 | 역할 | 병합 기준 |
|---|---|---|
| `main` | 앱 출시 후보의 기준 | 검증한 `develop`의 출시 PR만 반영 |
| `develop` | 다음 출시를 위한 기능 통합 | 작업 PR의 검사와 리뷰를 마친 변경 반영 |
| 작업 브랜치 | 하나의 검토 가능한 기능·수정·설정 작업 | 최신 `develop`에서 분기해 `develop`으로 PR |

현재 앱 저장소에는 `main`만 있다. 이 전략을 적용할 때 깨끗한 `main`에서 `develop`을 만들고 원격에 게시한다. `develop`과 `main`은 앱이 실행되고 정적 검사가 통과하는 상태로 유지한다. 백엔드와 앱은 별도 저장소·브랜치·PR을 사용한다.

## 2. 작업 단위와 이름

브랜치 하나는 화면 파일 하나가 아니라 완료 조건을 확인할 수 있는 **사용자 흐름 또는 작은 변경 하나**에 대응한다. 기능 ID(`F-M01`~`F-M08`)를 연결하되, 한 기능이 커지면 앱의 사용자 흐름별로 나눈다. 서로 의존하는 화면은 사용자가 실제로 끝까지 이동할 수 있는 단위로 묶는다.

| 유형 | 형식 | 예시 |
|---|---|---|
| 기능 | `feature/{F-ID}-{영문-슬러그}` | `feature/F-M01-app-onboarding`, `feature/F-M03-expense-entry-list` |
| 오류 수정 | `fix/{영문-슬러그}` | `fix/expense-month-navigation` |
| 개발 환경·설정 | `chore/{영문-슬러그}` | `chore/app-ci-checks` |
| 문서 | `docs/{영문-슬러그}` | `docs/app-branch-strategy` |

첫 사용자 흐름은 백엔드 `bootTestRun`의 가짜 로그인으로 **로그인 → 펫 선택 → 현재 월 예산 설정 → 홈**을 확인한다. 실제 카카오·구글 SDK 연동은 별도 작업으로 다룰 수 있다. 이후 지출 입력·월 목록·홈 갱신을 하나의 검토 가능한 흐름으로 구현한다. 작업 시작 전에 해당 흐름의 완료 조건과 필요한 백엔드 API를 PR 설명 또는 작업 기록에 적는다.

## 3. 작업 PR

작업 브랜치는 최신 `develop`을 기준으로 만든다. PR 대상도 `develop`이다. PR에는 다음을 간결하게 기록한다.

1. 관련 기능 ID와 사용자가 보게 되는 변화
2. 사용한 API와 계약 변경 여부; 백엔드 변경이 필요하면 해당 PR 링크와 검증한 백엔드 커밋
3. 확인한 화면·기기와 실행 결과
4. 실행한 검사 명령과 결과, 남은 제한

제품·API 계약이 바뀌면 먼저 백엔드 기준 문서와 구현을 맞추고, 앱의 `docs/api-spec.md` 및 관련 문서를 함께 갱신한다. 앱에서 임의로 새 응답 필드·상태 코드·경로를 확정하지 않는다. `docs/00-renewal-development-guide.md`가 문서 충돌 시 우선한다.

## 4. 병합 전 검증

모든 앱 코드 작업 PR에서 `npm run lint`와 `npm run typecheck`를 실행한다. 라우팅·의존성·앱 설정에 영향을 주는 변경은 iOS 번들 생성도 확인한다(`npx expo export --platform ios`). 명령이 실제로 성공한 결과만 PR에 적는다.

사용자 흐름을 바꾼 PR은 iOS 시뮬레이터에서 관련 화면을 실제로 실행한다. 지출 생성·수정·삭제처럼 서버 값을 바꾸는 흐름은 `petgyebu_backend_renewal`의 `./gradlew bootTestRun`과 연결해 응답 및 화면 갱신을 확인한다. Android에서 다른 동작이 예상되는 네이티브 기능은 Android 에뮬레이터도 확인하고, 출시 후보에서는 iOS·Android 핵심 흐름을 모두 확인한다. 번들 생성만으로 기기 실행을 검증했다고 기록하지 않는다.

PR 리뷰에서는 `AGENTS.md`와 현행 제품·API 문서의 완료 조건, 오류·빈 상태, 토큰 및 개인 정보 취급, 실제 검사 결과를 대조한다. 검증·리뷰가 끝난 작업 PR은 `develop`에 **squash merge**하고 작업 브랜치를 삭제한다. 커밋과 작업 PR 제목은 Conventional Commits 형식(`feat:`, `fix:`, `chore:`, `docs:` 등)을 사용한다.

현재 문서는 GitHub의 브랜치 보호, 필수 검사 또는 자동 브랜치 삭제가 설정됐다는 증거가 아니다. 저장소 설정은 별도로 확인한 뒤 적용한다. CI가 마련되기 전에는 위 로컬 검증 결과를 PR에 기록한다.

## 5. 출시와 태그

출시 후보를 정하면 검증할 앱 `develop` 커밋과 백엔드 커밋을 함께 고정한다. 검증 중 새 기능이 `develop`에 병합되어 대상이 바뀌면 검증 대상을 다시 고정하거나 릴리스 브랜치를 사용한다. 출시 PR에는 포함 기능, iOS·Android 핵심 흐름 확인 결과, 백엔드 버전·커밋과 알려진 제한을 적는다.

검증된 `develop`의 출시 PR은 `main`에 **일반 merge commit**으로 병합한다. 출시 뒤 `main`의 결과를 `develop`에도 반영한다. `v0.{N}.0` 태그는 스프린트 완료만으로 만들지 않고, 검증된 출시 후보가 `main`에 병합된 뒤 남긴다. 태그는 앱의 배포 기준점이며 스토어 배포 완료를 뜻하지 않는다.
