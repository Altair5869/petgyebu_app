import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';

import { LoadingView, MessageView } from '@/components/message-view';
import { apiBaseUrl } from '@/config';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { SessionProvider, useSession } from '@/session/session-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  if (!apiBaseUrl) {
    SplashScreen.hide();
    return <MessageView message="API 주소(EXPO_PUBLIC_API_BASE_URL)가 설정되지 않았어요. .env.local을 확인해 주세요." />;
  }
  return (
    <SessionProvider baseUrl={apiBaseUrl}>
      <RootNavigator />
    </SessionProvider>
  );
}

function RootNavigator() {
  const { state, retry } = useSession();

  useEffect(() => {
    if (state.status !== 'loading') SplashScreen.hide();
  }, [state.status]);

  if (state.status === 'loading') return <LoadingView />;
  if (state.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;

  const stage = state.status === 'signedIn' ? state.stage : null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={state.status === 'signedOut'}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'pet'}>
        <Stack.Screen name="pet" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'budget'}>
        <Stack.Screen name="budget" />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'ready'}>
        <Stack.Screen name="index" />
        <Stack.Screen name="expenses/new" options={{ headerShown: true, title: '지출 기록', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="expenses/index" options={{ headerShown: true, title: '월별 통계', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="expenses/[id]" options={{ headerShown: true, title: '지출 수정', headerBackTitle: '뒤로' }} />
        <Stack.Screen name="settings/budget" options={{ headerShown: true, title: '예산 변경', headerBackTitle: '뒤로' }} />
      </Stack.Protected>
    </Stack>
  );
}
