import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Home } from '@/api/types';
import { Button } from '@/components/button';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { describeBalance, formatUsagePercent, formatWon } from '@/lib/money';
import { monthTitle } from '@/lib/month';
import { PET_LABELS, PET_STATE_COPY } from '@/lib/pet';
import { useSession } from '@/session/session-provider';

type HomeLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; home: Home };

const LOAD_FAILED = '정보를 불러오지 못했어요. 다시 시도해 주세요.';

function isStageError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'PET_REQUIRED' || error.code === 'BUDGET_REQUIRED');
}

export default function HomeScreen() {
  const { api, refreshStage } = useSession();
  const [load, setLoad] = useState<HomeLoad>({ status: 'loading' });

  const fetchHome = useCallback(() => {
    const showError = (message: string) => () => setLoad({ status: 'error', message });
    return api.getHome().then(
        (home) => setLoad({ status: 'loaded', home }),
        (error: unknown) => {
          // e.g. the month rolled over while the app was open: let the session route to pet/budget.
          // If the stage stays 'ready' (or the check fails), this screen remains, so offer a retry.
          if (isStageError(error)) refreshStage().then(showError(LOAD_FAILED), showError(LOAD_FAILED));
          else showError(CONNECTION_ERROR)();
        },
      );
  }, [api, refreshStage]);

  // Runs on first display and every return to this screen (e.g. after saving an expense).
  useFocusEffect(
    useCallback(() => {
      fetchHome();
    }, [fetchHome]),
  );

  // Coming back to the foreground may mean a new month or an expired session; refetch quietly.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') fetchHome();
    });
    return () => subscription.remove();
  }, [fetchHome]);

  function retry() {
    setLoad({ status: 'loading' });
    fetchHome();
  }

  if (load.status === 'loading') return <LoadingView />;
  if (load.status === 'error') return <MessageView message={load.message} actionLabel="다시 시도" onAction={retry} />;

  const { home } = load;
  const petCopy = PET_STATE_COPY[home.petState];
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.month}>{monthTitle(home.month)}</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="설정" onPress={() => router.push('/settings')}>
            <Text style={styles.settingsLink}>설정</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          <Text style={styles.petLine}>
            {PET_LABELS[home.petType]} · {petCopy.name}
          </Text>
          <Text style={styles.body}>{petCopy.description}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.balance}>{describeBalance(home.budgetBalanceAmount)}</Text>
          <Text style={styles.body}>사용률 {formatUsagePercent(home.usagePercent)}</Text>
          <Text style={styles.caption}>
            {formatWon(home.budgetAmount)} 중 {formatWon(home.spentAmount)} 사용
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>지출 기록</Text>
          {home.spentAmount === 0 && <Text style={styles.body}>첫 지출을 기록해 보세요</Text>}
          <Button label="지출 기록하기" onPress={() => router.push('/expenses/new')} />
          <Pressable accessibilityRole="link" accessibilityLabel="월별 통계" onPress={() => router.push('/expenses')}>
            <Text style={styles.link}>월별 통계</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, gap: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsLink: { fontSize: 15, color: '#1565C0', paddingVertical: 8, paddingLeft: 16 },
  month: { fontSize: 16, color: '#555' },
  card: { borderRadius: 16, backgroundColor: '#F5F7FA', padding: 20, gap: 8 },
  petLine: { fontSize: 22, fontWeight: '700', color: '#111' },
  balance: { fontSize: 24, fontWeight: '700', color: '#111' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  body: { fontSize: 16, color: '#333' },
  link: { fontSize: 15, color: '#1565C0', textAlign: 'center', paddingVertical: 8 },
  caption: { fontSize: 14, color: '#666' },
});
