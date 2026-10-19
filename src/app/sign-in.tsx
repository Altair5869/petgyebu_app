import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Provider } from '@/api/types';
import { SocialLoginButton } from '@/components/social-login-button';
import { errorMessage } from '@/lib/error-message';
import { useSession } from '@/session/session-provider';
import { SocialLoginCancelledError } from '@/session/social-credential';

export default function SignInScreen() {
  const { signIn } = useSession();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePress(provider: Provider) {
    if (pending) return;
    setPending(provider);
    setError(null);
    try {
      await signIn(provider);
    } catch (e) {
      // Closing the login window is the user's choice, not a failure.
      if (!(e instanceof SocialLoginCancelledError)) setError(errorMessage(e));
      setPending(null);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>펫계부</Text>
        <Text style={styles.subtitle}>펫과 함께 예산을 지켜요</Text>
      </View>
      <View style={styles.actions}>
        <SocialLoginButton
          provider="kakao"
          onPress={() => void handlePress('kakao')}
          loading={pending === 'kakao'}
          disabled={pending !== null}
        />
        <SocialLoginButton
          provider="google"
          onPress={() => void handlePress('google')}
          loading={pending === 'google'}
          disabled={pending !== null}
        />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', padding: 24, backgroundColor: '#fff' },
  header: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 16, color: '#555' },
  actions: { gap: 12 },
  error: { color: '#D93025', textAlign: 'center' },
});
