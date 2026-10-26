# Petgyebu 앱: Claude Code 작업 안내

@AGENTS.md

작업 전 `docs/00-renewal-development-guide.md`를 현재 제품·API 계약의 우선 기준으로 확인한다. 필요한 기능의 세부 내용은 `docs/01-prd.md`, `docs/02-requirements-features.md`, `docs/03-user-flow.md`, `docs/api-spec.md`에서 관련 부분만 읽는다.

브랜치 생성, PR, 병합, 출시 작업을 할 때는 `docs/07-branch-strategy.md`를 먼저 읽고 따른다. 작업 브랜치는 최신 `develop`에서 만들고 `develop`으로 PR을 보낸다. 앱과 백엔드 계약을 함께 바꾸는 작업은 양쪽 저장소의 PR과 검증 커밋을 연결한다.

실행한 적 없는 검사나 기기 확인을 완료했다고 보고하지 않는다. 현재 앱의 필수 검사는 `npm run lint`, `npm run typecheck`, `npm test`이며, 사용자 흐름 변경은 관련 화면을 시뮬레이터에서 확인한다.
