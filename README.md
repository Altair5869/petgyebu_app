# petgyebu_app
펫 감정기반 가계부

## 검사

```bash
npm run lint       # ESLint (eslint-config-expo)
npm run typecheck  # tsc --noEmit
```

`expo-env.d.ts`는 git에 올리지 않는 자동 생성 파일이다. 새로 clone했다면 `npx expo start`를 한 번 실행한 뒤 타입 검사를 한다.

## 동작 확인: 지출 입력 → 월 목록 → 홈 갱신

**백엔드**: `petgyebu_backend_renewal` 저장소에서 `./gradlew bootTestRun`을 실행한다(포트 8080). 가짜 소셜 검증기를 쓰므로 `credential: "ok:<아무 ID>"`로 로그인한다.

**기기**: 기본은 iOS 시뮬레이터(`npm run ios`)다. 카카오·구글 SDK처럼 네이티브 모듈이 들어가면 Expo Go 대신 개발 빌드(`npx expo run:ios`)를 쓴다. 기기별 API 주소는 `.env.local`의 `EXPO_PUBLIC_API_BASE_URL`에 넣는다.

| 기기 | `EXPO_PUBLIC_API_BASE_URL` |
| --- | --- |
| iOS 시뮬레이터 | `http://localhost:8080/api/v1` |
| Android 에뮬레이터 | `http://10.0.2.2:8080/api/v1` |
| 실제 기기(같은 Wi-Fi) | `http://<PC LAN IP>:8080/api/v1` |

**확인 순서**: 로그인하고 펫·현재 월 예산을 설정한다. 그다음 지출을 저장하면 `POST /expenses`가 호출되고, 현재 월 목록(`GET /months/{month}/expenses`)을 첫 페이지부터 다시 불러오고, 새 항목이 날짜 내림차순 위치에 보여야 한다. 홈으로 돌아가면 `GET /home`이 다시 호출되어 사용 금액과 펫 상태가 바뀌어야 한다. 앱을 재시작해도 같은 값이 나오는지 확인한다.

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
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

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
