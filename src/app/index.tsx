import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Home } from '@/api/types';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { describeBalance, formatUsagePercent, formatWon } from '@/lib/money';
import { monthTitle } from '@/lib/month';
import { PET_LABELS, PET_STATE_COPY } from '@/lib/pet';
import { useSession } from '@/session/session-provider';

type HomeLoad = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; home: Home };

function isStageError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'PET_REQUIRED' || error.code === 'BUDGET_REQUIRED');
}

export default function HomeScreen() {
  const { api, refreshStage } = useSession();
  const [load, setLoad] = useState<HomeLoad>({ status: 'loading' });

  const fetchHome = useCallback(() => {
    const showError = () => setLoad({ status: 'error' });
    return api.getHome().then(
        (home) => setLoad({ status: 'loaded', home }),
        (error: unknown) => {
          // e.g. the month rolled over while the app was open: let the session route to pet/budget.
          // If the stage stays 'ready' (or the check fails), this screen remains, so offer a retry.
          if (isStageError(error)) refreshStage().then(showError, showError);
          else showError();
        },
      );
  }, [api, refreshStage]);

  useEffect(() => {
    fetchHome();
  }, [fetchHome]);

  function retry() {
    setLoad({ status: 'loading' });
    fetchHome();
  }

  if (load.status === 'loading') return <LoadingView />;
  if (load.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;

  const { home } = load;
  const petCopy = PET_STATE_COPY[home.petState];
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.month}>{monthTitle(home.month)}</Text>
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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, gap: 16 },
  month: { fontSize: 16, color: '#555' },
  card: { borderRadius: 16, backgroundColor: '#F5F7FA', padding: 20, gap: 8 },
  petLine: { fontSize: 22, fontWeight: '700', color: '#111' },
  balance: { fontSize: 24, fontWeight: '700', color: '#111' },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  body: { fontSize: 16, color: '#333' },
  caption: { fontSize: 14, color: '#666' },
});
