import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { Home } from '@/api/types';
import { BudgetGauge } from '@/components/budget-gauge';
import { InteractivePet } from '@/components/interactive-pet';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { describeBalance, formatUsagePercent, formatWon } from '@/lib/money';
import { monthTitle } from '@/lib/month';
import { PET_LABELS, PET_STATE_COPY } from '@/lib/pet';
import { useSession } from '@/session/session-provider';
import { colors as COLORS, fonts } from '@/theme';

type HomeLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; home: Home };

const LOAD_FAILED = '정보를 불러오지 못했어요. 다시 시도해 주세요.';

function isStageError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'PET_REQUIRED' || error.code === 'BUDGET_REQUIRED');
}

export default function HomeScreen() {
  const { api, refreshStage } = useSession();
  const [load, setLoad] = useState<HomeLoad>({ status: 'loading' });
  const [focused, setFocused] = useState(false);

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
      setFocused(true);
      fetchHome();
      return () => setFocused(false);
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

  if (load.status !== 'loaded') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.message}>
          {load.status === 'loading' ? <ActivityIndicator color={COLORS.primary} /> : (
            <>
              <Text style={styles.body}>{load.message}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="다시 시도" onPress={retry} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                <Text style={styles.actionLabel}>다시 시도</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { home } = load;
  const petCopy = PET_STATE_COPY[home.petState];
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.month}>{monthTitle(home.month)}</Text>
          <Pressable accessibilityRole="link" accessibilityLabel="설정" onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.settingsTarget, pressed && styles.pressed]}>
            <Text style={styles.settingsLink}>설정</Text>
          </Pressable>
        </View>
        <View style={styles.petSection}>
          <View>
            <InteractivePet petType={home.petType} petState={home.petState} focused={focused} />
            <BudgetGauge
              petState={home.petState}
              size="home"
              budgetAmount={home.budgetAmount}
              budgetBalanceAmount={home.budgetBalanceAmount}
            />
          </View>
          <Text accessibilityLabel={`${PET_LABELS[home.petType]}, ${petCopy.name}`} style={styles.petLine}>
            {petCopy.name}
          </Text>
          <Text style={styles.body}>{petCopy.description}</Text>
        </View>
        <View style={styles.budgetCard}>
          <Text style={styles.balanceLabel}>{home.budgetBalanceAmount < 0 ? '초과 금액' : '남은 예산'}</Text>
          <Text accessibilityLabel={home.budgetBalanceAmount === 0 ? '예산을 모두 사용했어요, 남은 예산 0원' : describeBalance(home.budgetBalanceAmount)} style={styles.balance}>
            {formatWon(Math.abs(home.budgetBalanceAmount))}
          </Text>
          <View style={styles.usageBadge}>
            <Text style={styles.usage}>사용률 {formatUsagePercent(home.usagePercent)}</Text>
          </View>
          <View style={styles.totals}>
            <View style={styles.total}>
              <Text style={styles.caption}>이번 달 지출</Text>
              <Text style={styles.totalAmount}>{formatWon(home.spentAmount)}</Text>
            </View>
            <View style={styles.total}>
              <Text style={styles.caption}>이번 달 예산</Text>
              <Text style={styles.totalAmount}>{formatWon(home.budgetAmount)}</Text>
            </View>
          </View>
        </View>
        <Pressable accessibilityRole="link" accessibilityLabel="월별 통계" onPress={() => router.push('/expenses')} style={({ pressed }) => [styles.statsLink, pressed && styles.pressed]}>
          <Text style={[styles.link, styles.statsLabel]}>월별 통계 보기</Text>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.link}>→</Text>
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="이번 주 돌아보기" onPress={() => router.push('/insights')} style={({ pressed }) => [styles.statsLink, pressed && styles.pressed]}>
          <Text style={[styles.link, styles.statsLabel]}>이번 주 돌아보기</Text>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.link}>→</Text>
        </Pressable>
      </ScrollView>
      <View style={styles.footer}>
        {home.spentAmount === 0 && <Text style={styles.firstRecord}>첫 지출을 기록해 보세요</Text>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="지출 기록하기"
          onPress={() => router.push('/expenses/new')}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionLabel}>＋ 지출 기록하기</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, gap: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  settingsTarget: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  settingsLink: { fontFamily: fonts.regular, fontSize: 15, color: COLORS.primary },
  month: { flexShrink: 1, fontSize: 20, fontFamily: fonts.bold, color: COLORS.text },
  petSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 8, gap: 8 },
  petLine: { fontSize: 17, fontFamily: fonts.bold, color: COLORS.primary, textAlign: 'center', marginTop: 8 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: COLORS.text, textAlign: 'center' },
  budgetCard: { borderRadius: 24, backgroundColor: COLORS.surface, padding: 24, gap: 12 },
  balanceLabel: { fontFamily: fonts.regular, fontSize: 15, color: COLORS.muted },
  balance: { fontSize: 34, fontFamily: fonts.bold, color: COLORS.text, fontVariant: ['tabular-nums'] },
  usageBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.secondary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  usage: { fontSize: 14, fontFamily: fonts.bold, color: COLORS.primary },
  totals: { borderTopWidth: 1, borderTopColor: COLORS.secondary, paddingTop: 16, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  total: { flexGrow: 1, flexBasis: 120, gap: 8 },
  totalAmount: { fontSize: 17, fontFamily: fonts.bold, color: COLORS.text, fontVariant: ['tabular-nums'] },
  caption: { fontFamily: fonts.regular, fontSize: 14, color: COLORS.muted },
  firstRecord: { fontFamily: fonts.regular, fontSize: 14, color: COLORS.muted, textAlign: 'center' },
  statsLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderRadius: 16, backgroundColor: COLORS.secondary, padding: 16 },
  statsLabel: { flexShrink: 1 },
  link: { fontSize: 15, fontFamily: fonts.bold, color: COLORS.primary },
  footer: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 12 },
  action: { minHeight: 56, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', padding: 16 },
  actionLabel: { fontSize: 17, fontFamily: fonts.bold, color: COLORS.surface, textAlign: 'center' },
  pressed: { opacity: 0.8 },
  message: { flex: 1, justifyContent: 'center', padding: 24, gap: 24 },
});
