# 지출 등록 중복 방지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /expenses`에 선택 헤더 `Idempotency-Key`를 추가해 같은 키·같은 본문의 재시도는 기존 지출을 200으로 돌려주고, 앱은 같은 입력의 재시도에 같은 키를 보내 시간 초과 뒤 다시 저장해도 한 건만 기록되게 한다.

**Architecture:**
- **백엔드:** 키를 `expenses` 행에 저장하고 `(user_id, idempotency_key)` 부분 유니크 인덱스를 둔다. 서비스가 같은 키의 기존 행을 찾아 본문을 비교한다. 동시 삽입 때문에 유니크 충돌이 나면 다시 조회해 같은 규칙을 적용한다.
- **앱:** 등록 화면이 마지막으로 보낸 입력과 키를 기억하고, 입력이 같으면 키를 재사용한다.

**Tech Stack:** 백엔드 Java 25, Spring Boot 4.1.1, Spring Data JDBC, PostgreSQL 16, Flyway, JUnit + Testcontainers. 앱 Expo SDK 58(`expo-crypto`), React Native 0.88, Jest 30 + RNTL 14, Maestro.

**Spec:** `docs/superpowers/specs/2026-10-21-f-m03-expense-idempotency-design.md` (앱 저장소)

## Global Constraints

- 헤더 이름: `Idempotency-Key`. 값은 UUID(표준 36자, 대소문자 무관). 헤더는 선택이며, 없으면 기존 동작 그대로다.
- 응답 규칙:
  - 새로 만들면 201.
  - 같은 사용자·같은 키·같은 본문(정규화 후 `amount`, `expenseDate`, `category`, `memo`)이면 200과 기존 지출.
  - 같은 키에 본문이 다르면 409 `IDEMPOTENCY_KEY_REUSED`.
  - 키 형식이 틀리면 400 `INVALID_REQUEST`(field `Idempotency-Key`).
  - 본문 검증이 키 조회보다 먼저다.
- DB: Flyway `V2__expense_idempotency_key.sql`(이름은 구현자가 기존 규칙에 맞춘다). `expenses.idempotency_key UUID NULL` 컬럼과 `UNIQUE (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL` 부분 유니크 인덱스를 추가한다.
- 앱 문구:
  - 시간 초과: `SAVE_UNCONFIRMED = '저장됐는지 확인하지 못했어요. 다시 저장해도 한 번만 기록돼요.'`
  - 409: `'이미 저장된 기록과 내용이 달라요. 월별 통계에서 확인해 주세요.'`
  - 그 밖의 오류는 `errorMessage()`를 쓴다.
- 앱 키: `expo-crypto` `randomUUID()`(`npx expo install expo-crypto`, 개발용 앱 재빌드 필요). 같은 입력의 재시도에는 같은 키를, 입력이 바뀌면 새 키를 쓴다.
- 토큰·키를 로그에 남기지 않는다.
- 백엔드 규칙은 `petgyebu_backend_renewal/AGENTS.md`, 앱 규칙은 `petgyebu_app/AGENTS.md`를 따른다. karpathy 가이드라인을 지킨다.
- 커밋은 Conventional Commits 형식으로 하고 `Co-Authored-By` 줄을 붙인다.
- 검사:
  - 백엔드: `./gradlew test --no-daemon`
  - 앱: `npm run lint`, `npm run typecheck`, `npm test`, `npx expo export --platform ios`

## Review Focus

- 동시에 같은 키로 두 요청이 들어오는 경우: 한 건만 생기고 두 응답이 모두 201/200 중 하나여야 한다. 500이 나면 안 된다(Task 1 테스트).
- 카테고리 생략과 `OTHER` 명시, 메모 생략과 `null`은 같은 본문으로 본다(Task 1 테스트).
- 시간 초과 뒤 금액을 고쳐 다시 저장하는 경우: 새 키를 쓰므로 409가 아니라 새 지출이 생긴다(Task 2 테스트).
- 다른 사용자의 같은 키는 서로 영향이 없다(Task 1 테스트).
- 시간 초과 뒤 같은 입력으로 다시 저장해도 월별 통계에 한 건만 있다(Task 2 Maestro).

---

### Task 1: 백엔드 `Idempotency-Key` (저장소 `~/Desktop/petgyebu_backend_renewal`, 브랜치 `feature/F-M03-expense-idempotency`)

**Files:**
- Create: `src/main/resources/db/migration/V2__*.sql`
- Modify: `expense/Expense.java`(`idempotencyKey` 필드), `ExpenseRepository.java`(사용자·키 조회), `ExpenseService.java`(`create`), `ExpenseController.java`(헤더, 201/200 분기), `common/ApiException.java`(409 코드), `docs/00-renewal-development-guide.md` API 절(계약 한 줄 + 오류 코드)
- Test: 기존 `ExpenseApiTests`에 추가하거나 새 테스트 클래스

**Interfaces:**
- 컨트롤러: `@RequestHeader(value = "Idempotency-Key", required = false) String key`. 응답 상태는 서비스 결과(새로 만듦 / 기존 반환)에 따라 201 또는 200이다. 본문 형식은 기존 `ExpenseResponse`다.

- [ ] **Step 1: 실패하는 테스트** — 스펙 §4 백엔드 목록 8개를 테스트로 작성한다.
  - 동시성 테스트는 두 스레드가 같은 키로 동시에 보내고, 결과가 {201, 200} 또는 {201, 409 아님}인지, DB 건수가 1인지 확인한다.
- [ ] **Step 2:** `./gradlew test --no-daemon --tests '*Expense*'`를 실행해 FAIL을 확인한다.
- [ ] **Step 3:** 마이그레이션과 코드를 구현한다.
- [ ] **Step 4:** 같은 명령을 실행해 PASS를 확인한다. 이어서 `./gradlew test --no-daemon` 전체를 돌린다.
- [ ] **Step 5:** `bootTestRun`을 띄워 `curl`로 확인한다. 같은 키로 두 번 보내면 201 다음 200이고 id가 같아야 한다. 결과를 보고서에 적는다.
- [ ] **Step 6:** `docs/00-renewal-development-guide.md`의 API·오류 코드 부분을 갱신한다.
- [ ] **Step 7: Commit** `feat: accept an Idempotency-Key on expense creation (F-M03)`

### Task 2: 앱 키 전송·재사용·문구 (저장소 `~/Desktop/petgyebu_app`, 브랜치 `feature/F-M03-expense-idempotency`)

**Files:**
- Modify:
  - `src/api/client.ts`: `createExpense(body, idempotencyKey)`. `send`에 추가 헤더 인자를 받는다.
  - `src/app/expenses/new.tsx`: 마지막 입력과 키를 기억하고, 409를 처리한다.
  - `src/lib/error-message.ts`: 새 문구.
  - `docs/api-spec.md`: 계약.
  - `package.json`: `expo-crypto`.
  - `.maestro/expenses/request-timeout.yaml`, README "서버 응답 멈추기".
- Test: `__tests__/api-client-test.ts`, `__tests__/new-expense-screen-test.tsx`, `__tests__/error-message-test.ts`

**Interfaces:**
- Consumes: Task 1 계약(201/200/409).
- Produces: `api.createExpense(body: NewExpense, idempotencyKey: string): Promise<Expense>`

- [ ] **Step 1:** `npx expo install expo-crypto`(SDK 58 문서로 `randomUUID` 확인).
- [ ] **Step 2: 실패하는 테스트**
  - `createExpense` → 헤더 `Idempotency-Key: k1`
  - 등록 화면(`expo-crypto` 모킹으로 `k1`, `k2` 순서 반환):
    - 첫 저장이 `RequestTimeoutError` → 같은 입력으로 다시 저장 → 두 호출 모두 키 `k1`
    - 첫 저장이 시간 초과 → 금액을 바꿔 다시 저장 → 두 번째 키 `k2`
    - 시간 초과 문구가 새 `SAVE_UNCONFIRMED`
    - `ApiError(409,'IDEMPOTENCY_KEY_REUSED')` → 충돌 문구
- [ ] **Step 3:** `npx jest __tests__/api-client-test.ts __tests__/new-expense-screen-test.tsx __tests__/error-message-test.ts` → FAIL
- [ ] **Step 4:** 구현한다. `docs/api-spec.md`의 `POST /expenses` 절에 헤더·200·409·400을 적는다.
- [ ] **Step 5:** 같은 명령 → PASS. 이어서 `npm test`.
- [ ] **Step 6:** `npx expo prebuild --platform ios --clean && npx expo run:ios`로 다시 빌드한다(`expo-crypto` 네이티브).
- [ ] **Step 7:** 시뮬레이터에서 확인한다. 백엔드는 Task 1 브랜치를 `bootTestRun`으로 띄운다.
  - `first-login` → 갱신한 `request-timeout` 순서: STOP → 저장 → 새 문구 → CONT → 다시 저장 → 월별 통계에 그 금액 한 건
  - `record-and-list` 회귀
  - 각각의 exit code를 기록한다.
- [ ] **Step 8:** lint, typecheck, test, export를 실행해 모두 성공해야 한다.
- [ ] **Step 9: Commit** `feat: send an Idempotency-Key so a retried expense save is recorded once (F-M03)`
