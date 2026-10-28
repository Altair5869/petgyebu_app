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

## 홈 펫 상호작용

- 홈의 고양이와 강아지에 적용한다. 기존 155×120 크기·위치와 나머지 화면 디자인은 유지한다.
- 안정·주의·경고는 4~7초 간격으로 눈 표정이 잠깐 바뀐다. 강아지의 안정 원본은 이미 웃는 눈이므로 편안한 눈매로 바뀌었다 돌아온다. 예산 도달에서는 자동 동작을 멈춘다.
- 머리를 누르면 잠깐 눈을 감고, 놓으면 현재 예산 감정으로 돌아온다. 반응 중 예산이 바뀌면 종료 후 최신 상태를 표시한다. 볼 드래그는 아직 구현하지 않았다.
- 동작 줄이기에서는 자동 깜빡임을 생략하고 정지된 감은 눈 반응만 표시한다. 화면 이탈·백그라운드·터치 취소 시 반응을 종료한다. Android 알림창 포커스 이벤트는 Android에서만 구독한다.
- `assets/images/pets/cat-interaction/`, `dog-interaction/`에 각 펫의 네 감정 × 세 표정 PNG가 있다. 모두 **465×360 단일 파일**이며 @2x/@3x 변형은 없다. 홈의 155×120pt 표시 크기는 그대로다. 화면에 쓸 세 장을 먼저 디코딩하고, 디코딩 실패 시 해당 펫의 기존 정지 이미지를 유지한다. 앱 실행 중 색 분석이나 Canvas 합성은 하지 않는다.
- PNG는 사용자가 확인한 미리보기 합성 결과다. 미리보기 원본과 서버(`output/cat-interaction-preview/`)는 저장소에 넣지 않고 로컬에만 둔다. 미리보기 서버를 실행한 뒤 `node scripts/export-cat-frames.cjs`로 다시 내보낼 수 있다. 설치된 Chrome의 헤드리스 모드와 일회성 임시 프로필을 사용하며, 다른 설치 경로는 `CHROME_BIN`으로 지정한다. 재생성 후에는 표정과 볼 경계를 다시 확인한다.
- `src/components/interactive-pet.tsx`와 `src/lib/pet-interaction.ts`가 두 펫의 동작을 공유한다. 펫 종류를 변경하면 진행 중인 반응과 이미지 로딩을 취소한다. `pet-interaction-test.ts`, `interactive-pet-test.tsx`, `cat-frame-assets-test.cjs`, `dog-frame-assets-test.cjs`가 상태 복귀·접근성 설정·화면 이탈·디코딩 실패·프레임 정렬을 검사한다.
- 실제 앱 확인: 테스트 백엔드에 연결된 고양이 계정에서 `maestro --device <UDID> test -e APP_URL=http://127.0.0.1:8081 .maestro/home/cat-interaction.yaml`. 이 시나리오는 지출·예산을 변경하지 않으며, 터치와 화면 이동·복귀를 확인한다. 반응의 자연스러움과 짧은 프레임 전환은 별도 화면 확인이 필요하다.

### 프레임 축소와 강아지 눈 보정 (F-M02)

- 두 export 스크립트는 로컬 미리보기의 744×576 합성 결과에 동일한 **area 리샘플링**을 적용해 465×360으로 저장한다. `scripts/resize-pet-frames.cjs`가 알파를 고려해 색을 평균하고, 상태별 원본의 투명도와 강아지 볼터치 픽셀을 고정한다. 파일 이름과 `require` 경로는 유지한다.
- `du -sh assets/images/pets/*-interaction`: 고양이 **4.2M → 1.6M**, 강아지 **3.9M → 1.6M**. PNG 실제 바이트 합계는 8,512,829 → 3,308,661로 약 61.1% 감소했다. RGBA 픽셀 버퍼 계산값은 장당 1,714,176 → 669,600바이트다(기기 메모리 실측값 아님).
- 강아지 안정·closed의 눈 선을 올려 볼터치와 분리했고, 주의·half의 끊긴 테두리와 흰 점을 정리하며 위쪽 눈꺼풀을 곡선으로 바꿨다. 경고·예산 도달·half의 베이지색 눈 위 얼룩을 제거했다.
- 고양이 접근성 안내는 “머리를 쓰다듬으면 잠깐 눈을 감아요”, 강아지는 “머리를 쓰다듬으면 잠깐 편안한 눈매가 돼요”다.
- 눈 밖 픽셀·실루엣·투명도·원본 볼터치 고정 검사를 유지한다. 필터 경계에는 출력 기준 1px 여유만 두며, 그 밖의 픽셀은 정확히 비교한다. 정지 그림과 프레임의 표시 크기·정렬 및 원본 대비 실루엣 경계를 테스트한다.
- 확대 비교 파일은 로컬 `output/pet-frame-polish/`의 `dog-frame-comparison.png`, `dog-eye-comparison.png`, `dog-polish-before-after.png`, `cat-frame-comparison.png`에 있다. **output/은 커밋하지 않는다.**
- **Claude Code QA 예정**: 이번 수정의 시뮬레이터·Maestro 확인은 실행하지 않았다. 아래 기록은 이전 상호작용 적용 당시의 확인 결과다.

### 강아지 적용 및 확인 (2026-10-24, F-M02)

- 기존 강아지 원본과 네 예산 감정을 유지하고, 눈 부분만 합성한 프레임을 추가했다. 눈 영역 밖의 모든 픽셀·원본 볼터치·투명도를 유지하는 검사를 통과했다. 볼 드래그는 포함하지 않는다. 기존 `GET /api/v1/home`만 사용하며 API 계약은 변경하지 않았다.
- lint·typecheck 통과, Jest **28 suites / 337 tests 통과**. 고양이·강아지 네 상태의 터치 종료와 최신 예산 복귀, 펫 교체 중 반응 취소를 포함한다.
- iPhone 17e / iOS 27.0, `bootTestRun`(8080), Metro(8082)에서 `.maestro/home/dog-interaction.yaml` 통과. 안정 상태 머리 탭·길게 누르기와 설정·지출 입력 화면 왕복 후 터치 재활성화를 확인했다. 테스트 후 펫을 원래 고양이로 복원했으며 예산·지출은 변경하지 않았다.
- 네 상태의 정지 프레임은 확대해서 검토했다. **iOS 네 상태 전체의 움직임, Android, 실제 스크린리더·동작 줄이기 조작은 확인하지 않았다.**
- 로컬 미리보기: `python3 output/dog-interaction-preview/serve-preview.py` → `http://127.0.0.1:8766/`. 상태 선택 후 ‘표정 프레임 재생’을 켜고 머리를 누른다. 원본·중간·감은 표정을 나란히 비교할 수 있다. 제작 PNG·프롬프트·미리보기는 기존 정책대로 `output/`에 로컬 보관한다.
- PNG 재생성: 미리보기 서버 실행 후 `node scripts/export-dog-frames.cjs`. 내장 imagegen으로 만든 눈 소재를 사용하고, Chrome의 임시 프로필로 Canvas 합성 결과를 읽어 465×360으로 area 축소한다. 사용자 브라우저 프로필이나 추가 패키지는 사용하지 않는다.

### 이번 적용의 확인 결과 (2026-10-23)

- lint·typecheck 통과, Jest **29 suites / 332 tests 통과**(이 중 2 suites는 이후 테스트 대상에서 뺀 `output/` 미리보기 테스트).
- iPhone 17e / iOS 27.0, `bootTestRun` 백엔드(8080), 별도 Metro(8082)에서 `.maestro/home/cat-interaction.yaml` 통과. 머리 탭·길게 누르기, 설정·지출 입력 화면 왕복 후 터치 재활성화를 확인했다.
- 실행 중 발견한 iOS `appStateFocusChange` 미지원 오류는 Android에만 focus/blur 이벤트를 등록하도록 수정했다. 해당 플랫폼 분기 회귀 검사도 추가했다.
- 안정 상태의 터치 전후 홈 캡처에서 고양이 위치·크기와 화면 배치를 검토했다. 네 감정의 타이밍·최신 예산 복귀는 Jest로 확인했다. **Android 실기기/에뮬레이터, iOS 네 감정 전체의 움직임·스크린리더 조작·동작 줄이기 설정을 실제 기기로 확인한 것은 아니다.**

## 동작 확인: 지출 입력 → 월 목록 → 홈 갱신

**백엔드**: `petgyebu_backend_renewal` 저장소에서 `./gradlew bootTestRun`을 실행한다(포트 8080). 가짜 소셜 검증기를 쓰므로 `credential: "ok:<아무 ID>"`로 로그인한다.

**기기**: 기본은 iOS 시뮬레이터다. 카카오·구글 SDK 같은 네이티브 모듈을 쓰므로 Expo Go 대신 개발용 앱(Expo development build)을 쓴다. `npm run ios`(`npx expo run:ios`)는 처음 한 번, 또는 네이티브 의존성이 바뀌었을 때만 실행해 앱을 설치한다(번들 ID `com.altair.petgyebu`). 평소에는 `npx expo start --clear`로 Metro만 띄우고 개발용 앱에서 연다. 기기별 API 주소는 `.env.local`의 `EXPO_PUBLIC_API_BASE_URL`에 넣는다.

**Android 에뮬레이터**: Android SDK(`ANDROID_HOME`)와 JDK 17이 필요하다. `npx expo prebuild --platform android --clean` 후 `JAVA_HOME=<JDK 17> npx expo run:android`로 설치한다(패키지 `com.altair.petgyebu`). `adb reverse tcp:8080 tcp:8080`과 `adb reverse tcp:8081 tcp:8081`을 걸면 iOS와 같은 `localhost` 주소를 그대로 쓸 수 있다. 에뮬레이터를 다시 켜면 `adb reverse`도 다시 건다.

| 기기 | `EXPO_PUBLIC_API_BASE_URL` |
| --- | --- |
| iOS 시뮬레이터 | `http://localhost:8080/api/v1` |
| Android 에뮬레이터 | `http://10.0.2.2:8080/api/v1`, 또는 `adb reverse tcp:8080 tcp:8080` 후 `http://localhost:8080/api/v1` |
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

**안드로이드 에뮬레이터에서 돌릴 때**

- 에뮬레이터는 GPU 가속으로 켠다(`emulator -avd <AVD> -gpu host`, AVD `config.ini`의 `hw.gpu.enabled=yes`, `hw.gpu.mode=host`). 소프트웨어 렌더링(SwiftShader)이면 Mac 부하로 앱이 "응답하지 않음(ANR)"을 띄워 시나리오가 실패한다. `adb shell dumpsys SurfaceFlinger | grep GLES`에 `SwiftShader`가 보이면 소프트웨어 렌더링이다.
- 앱이 `localhost`로 Metro·백엔드에 닿도록 `adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8080 tcp:8080`을 실행한다(에뮬레이터를 다시 켜면 다시 실행).
- 새 계정으로 처음부터 확인하려면 `adb shell pm clear com.altair.petgyebu`로 앱 데이터를 지운 뒤 `adb reverse`를 다시 실행한다.
- 실행: `maestro --device emulator-5554 test .maestro/onboarding/first-login.yaml`
- 헤더 뒤로 가기 버튼 이름은 iOS `뒤로`, 안드로이드 `Navigate up`이라 시나리오는 `"뒤로|Navigate up"`으로 누른다. 날짜 선택은 `subflows/pick-previous-month-15.yaml`이 플랫폼별로 나눠 처리한다. 안드로이드 날짜 대화상자 버튼("Change to previous month", "OK")은 영어 기준이라 에뮬레이터 언어를 영어로 둔다.
- 안드로이드에서 Maestro가 한글을 입력하면 입력 포커스를 잃으므로 시나리오의 메모 입력은 영문으로 쓴다.

**시나리오와 준비 상태**

| 파일 | 확인 내용 | 준비 |
|---|---|---|
| `onboarding/first-login.yaml` | 로그인 → 고양이 → 예산 300,000원 → 홈 | 새 개발용 ID, 로그인 화면 |
| `onboarding/relaunch-home.yaml` | 재실행 시 로그인 없이 홈 | `first-login` 이후 |
| `home/budget-states.yaml` | 고양이 홈에서 0·49.9·50·80·100·103.3% 사용률, 지출 후 갱신·통계 확인 및 화면 캡처 | 새 테스트 계정의 `first-login` 직후. 지출 310,000원(5건)을 생성하므로 `record-and-list`와 같은 초기 데이터에서 연이어 실행하지 않는다 |
| `home/dog-budget-states.yaml` | 강아지로 변경 후 예산 수정으로 네 표정·초과·긴 금액 확인 및 화면 캡처 | `home/budget-states` 직후. 완료 시 강아지·예산 100,000,000원·지출 310,000원 |
| `onboarding/relaunch-sign-in.yaml` | 세션이 끊기면 로그인 화면 | 아래 "앱 세션 끊기" |
| `onboarding/pet-only-relaunch.yaml` | 펫만 고르고 재실행하면 예산 화면부터 | 새 개발용 ID, 로그인 화면 |
| `onboarding/budget-range.yaml` | 0원·1억 원 초과면 저장 비활성 | 예산 화면이 열린 상태 |
| `onboarding/budget-suggestion.yaml` | 직전 달 예산 제안 | 펫만 고른 계정 + 아래 "직전 달 예산 넣기" |
| `onboarding/server-unavailable.yaml` | 서버가 꺼지면 연결 오류와 다시 시도 | 로그인된 계정, 백엔드 중지 |
| `expenses/record-and-list.yaml` | 지출 기록 → 홈 갱신 → 월별 통계 | `first-login` 직후 |
| `expenses/edit-and-delete.yaml` | 월별 통계에서 수정(금액·메모 지움·칩 유지) → 삭제 취소 → 삭제, 홈 금액 갱신 | `first-login` 직후 |
| `expenses/edit-deleted.yaml` | 수정 화면 중 다른 경로로 지출이 삭제되면 저장 시 안내 | `first-login` 직후 + 아래 "수정 화면 중 지출 지우기" |
| `stats/monthly-stats.yaml` | 이번 달 통계·카테고리 비중, 지난달(예산 없음), 지출 없는 달, 예산 초과 | `first-login` 직후 + 아래 "지난달 지출 넣기"(지난달 지출 1건, 7,000원·`old`) |
| `insights/weekly-insights.yaml` | 홈의 "이번 주 돌아보기"(스크롤 필요) → 지출 없음 안내 → 카페 12,000원 기록 → 늘어난 카테고리 요약·카테고리별 변화·예측 카드 | `first-login` 직후 |
| `stats/move-month.yaml` | 지난달 지출 수정 후 지난달 통계로 복귀, 이번 달 지출을 날짜 선택기로 지난달로 이동(이번 달에서 빠지고 홈 잔액 복원), 같은 화면에서 반복 | `first-login` 직후 + "지난달 지출 넣기"(금액 7,000원, 메모 `old`, 카테고리 `OTHER`). 다시 돌리려면 아래 "move-month 다시 돌리기 전 정리"를 실행하고 `old`를 7,000원으로 되돌린 뒤 이번 달 지출을 지운다 |
| `settings/change-pet-and-budget.yaml` | 설정에서 펫을 강아지로, 이번 달 예산을 450,000원으로 바꾸고 홈에 반영 | `first-login` 직후 |
| `settings/logout.yaml` | 로그아웃 → 로그인 화면 → 다시 로그인하면 홈 | 홈이 보이는 계정 |
| `settings/delete-account.yaml` | 탈퇴 취소, 탈퇴 → 로그인 화면 → 같은 ID로 새 계정(펫 선택부터) | 홈이 보이는 계정 |
| `expenses/validation.yaml` | 빈 금액·101자 메모는 저장 비활성 | 홈 |
| `expenses/paging.yaml` | 25건 통계 화면 무한 스크롤 | 새 개발용 ID, 아래 "이번 달 지출 25건 넣기" |
| `expenses/list-server-unavailable.yaml` | 백엔드가 꺼지면 월별 통계에서 오류와 다시 시도 | 홈이 열린 상태, 백엔드 중지 |
| `expenses/request-timeout.yaml` | 서버가 응답 없이 멈추면 10초 뒤 연결 오류, 지출 저장은 "저장됐는지 확인하지 못했어요. 다시 저장해도 한 번만 기록돼요." | `first-login` 직후 홈이 열린 상태, 아래 "서버 응답 멈추기" |
| `expenses/expense-retry-once.yaml` | 시간 초과 뒤 서버를 재개하고 같은 입력으로 다시 저장해도 월별 통계에 4,321원 1건 | `request-timeout` 직후(등록 화면 유지), 서버 재개 |

`stats/move-month.yaml`은 날짜 선택기의 접근성 이름(`Previous Month`, `15`)으로 지난달 15일을 고르고, 선택기를 닫을 때만 헤더 좌표(50%,10%)를 누른다. 접근성 이름은 시뮬레이터 언어가 영어일 때 기준이다. 흐름을 같은 계정에서 이어 돌린다고 가정하지 않는다. `monthly-stats`는 이번 달 지출 326,000원으로 예산을 넘긴 상태로 끝나므로, 그 뒤에 돌린 `move-month`·`edit-and-delete`·`settings/change-pet-and-budget`은 첫 단계의 "고양이, 안정"에서 실패한다. 이 흐름들과 `expenses/expense-retry-once`(절대값 4,321원 1건을 검증)는 각각 새 `first-login` 계정에서 돌린다. `settings/change-pet-and-budget`은 펫과 예산을 강아지·450,000원으로 바꾸고, `settings/delete-account`는 계정을 삭제하므로 그 계정에서는 맨 마지막에 돌린다. `move-month`는 `mv`(3,000원)·`mv2`(1,000원)를 지난달로 옮기므로, 다시 돌리기 전에는 아래 SQL로 지난달의 `mv`·`mv2`를 지우고 이번 달 지출을 앱에서 지우거나 `edit-deleted`의 DELETE(계정의 지출 전부 삭제)로 정리한다. 전부 지우면 `old`는 "지난달 지출 넣기"로 다시 넣는다.

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
# 중복 저장 확인 순서: request-timeout.yaml(끝나면 서버 멈춘 채 등록 화면) → kill -CONT → 아래 count 확인 → expense-retry-once.yaml → count 다시 확인
# 재개 직후 count: 1이면 멈췄던 요청이 저장된 것이라 재시도는 200 재생 경로, 0이면 요청이 버려진 것이라 재시도가 새로 만든다(201)
# 플로우 뒤 count는 어느 쪽이든 1이어야 한다(같은 Idempotency-Key로 다시 저장해도 지출 한 건만 남는다)
docker exec petgyebu_backend_renewal-postgres-1 psql -U petgyebu -d petgyebu -tAc \
  "select count(*) from expenses where amount=4321 and user_id=(select id from users where provider='KAKAO' and provider_user_id='<개발용 ID>')"

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
| `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` | 카카오 개발자 콘솔 앱의 네이티브 앱 키. 플랫폼 iOS에 번들 ID `com.altair.petgyebu`를, 플랫폼 Android에 패키지명 `com.altair.petgyebu`와 키 해시를 등록하고 카카오 로그인을 켠다 |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | 구글 클라우드 OAuth 클라이언트 "iOS"(번들 ID 동일). Android에는 필요 없다 |
| (앱 키 없음) | 구글 클라우드 OAuth 클라이언트 "Android": 패키지명 `com.altair.petgyebu`와 서명 인증서 SHA-1을 등록한다. 앱은 이 클라이언트 ID를 쓰지 않지만, 등록이 없으면 로그인이 `DEVELOPER_ERROR`로 실패한다 |
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

Android는 `npx expo prebuild --platform android --clean` 후 `npx expo run:android`. 개발 빌드는 `android/app/debug.keystore`로 서명되므로 SHA-1과 카카오 키 해시는 그 키스토어에서 뽑는다(`--clean`으로 다시 만들어도 같은 키스토어가 들어간다).

```bash
keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android | grep SHA1
keytool -exportcert -keystore android/app/debug.keystore -alias androiddebugkey -storepass android | openssl sha1 -binary | openssl base64
```

EAS 빌드나 Play 앱 서명으로 출시용 키가 바뀌면 SHA-1과 키 해시도 달라진다. 그 키의 값을 구글 Android OAuth 클라이언트와 카카오 Android 플랫폼에 추가로 등록해야 출시 빌드에서 로그인된다.

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
- 계정을 바꾸려면 홈 → 설정 → 로그아웃을 쓴다. 키체인까지 비우려면 위 Maestro 준비 5번의 `terminate` + `keychain reset`을 쓴다.

**가짜 로그인으로 되돌리기**: `EXPO_PUBLIC_DEV_LOGIN_ID`에 처음 쓰는 값을 넣고, 백엔드를 `bootTestRun`으로 바꾸고, `npx expo start --clear`로 Metro를 다시 시작한다. 자세한 순서는 위 "시뮬레이터 자동 확인 (Maestro)"의 준비를 따른다. 키 줄은 그대로 둬도 된다.

## 펫 그림 넣기

홈의 펫 그림 8장(고양이·강아지 × 상태 4개)은 `assets/images/pets/`에 있고 `src/lib/pet-images.ts`의 `PET_IMAGES`에 등록돼 있다. 등록이 빠진 펫·상태는 임시 상자(점선 테두리에 `CAT`·`STABLE`·"임시 그림")로 보인다.

펫 아래의 게이지는 그림이 아니라 코드(`src/components/budget-gauge.tsx`)로 그린다. 이번 달 예산 중 **남은 비율**만큼 차고(`budgetBalanceAmount / budgetAmount`), 다 쓰거나 초과하면 비어 있다. 색은 상태를 따른다(안정 연두, 주의 노랑, 경고 주황).

그림을 바꿀 때:

1. 원본은 저장소 밖에 둔다(지금 원본: ChatGPT 이미지, 1024~1254px 정사각형, 투명 배경, 펫이 그려진 게이지 위에 앉은 모습). 큰 원본을 커밋하지 않고, 1배율 이름으로 잘못 쓰이지 않게 하기 위해서다.
2. `python3 scripts/export-pet-images.py <원본 폴더> assets/images/pets`로 내보낸다(Pillow 필요). 그려진 게이지를 찾아 잘라내고, 펫을 124×96pt 캔버스 바닥에 맞춰 1·2·3배율 `{cat|dog}-{stable|caution|warning|budget-reached}.png`로 저장한다. 발이 캔버스 아래 끝에 닿아 코드 게이지 위에 앉는다.
3. `require`에는 항상 배율 없는 이름을 쓴다. Metro가 화면에 맞는 배율 파일을 고른다.
4. 그림과 게이지는 화면 낭독기에서 숨긴다. 바로 아래 글이 펫 상태와 남은 금액을 읽어 주므로 같은 내용을 두 번 듣지 않게 하기 위해서다.

상태별 연출 기준(안정은 편안함, 주의는 커진 눈, 경고는 안절부절하는 시선과 앞발, 예산 도달은 빈 게이지를 보는 놀란 눈)은 `docs/01-prd.md` 5절에 있다. 비난·질병·처벌 이미지는 쓰지 않는다.

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
