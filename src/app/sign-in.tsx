import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Provider } from '@/api/types';
import { PetImage } from '@/components/pet-image';
import { SocialLoginButton } from '@/components/social-login-button';
import { errorMessage } from '@/lib/error-message';
import { useSession } from '@/session/session-provider';
import { SocialLoginCancelledError } from '@/session/social-login-errors';
import { colors, contentWidth, fonts } from '@/theme';

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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>펫계부</Text>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.petScene}>
            <View style={styles.petBackdrop} />
            <View style={[styles.dot, styles.dotLeft]} />
            <View style={[styles.dot, styles.dotRight]} />
            <View style={styles.cat}>
              <PetImage petType="CAT" petState="STABLE" />
            </View>
            <View style={styles.dog}>
              <PetImage petType="DOG" petState="STABLE" />
            </View>
          </View>
          <View style={styles.copy}>
            <Text style={styles.headline}>{'펫과 함께 쓰는\n작은 소비 기록'}</Text>
            <Text style={styles.subtitle}>한 번의 기록으로, 이번 달 예산을 살펴봐요.</Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Text style={styles.invitation}>함께할 펫을 만나보세요</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { ...contentWidth, flexGrow: 1, padding: 24, gap: 32 },
  header: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  title: { fontSize: 32, fontFamily: fonts.bold, color: colors.text, textAlign: 'center', marginBottom: 8 },
  petScene: { width: '100%', maxWidth: 320, height: 224, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  petBackdrop: { position: 'absolute', width: '92%', height: 164, top: 32, borderRadius: 100, backgroundColor: colors.secondary },
  cat: { transform: [{ translateY: -12 }, { scale: 1.06 }] },
  dog: { transform: [{ translateY: 12 }] },
  dot: { position: 'absolute', backgroundColor: colors.primary, opacity: 0.2 },
  dotLeft: { width: 12, height: 12, borderRadius: 6, top: 28, left: 24 },
  dotRight: { width: 8, height: 8, borderRadius: 4, top: 56, right: 16 },
  copy: { width: '100%', alignItems: 'center', gap: 12, maxWidth: 280 },
  headline: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, color: colors.text, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: 'center' },
  actions: { gap: 12 },
  invitation: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginBottom: 4 },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger, textAlign: 'center' },
});
