import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { ExpenseRow } from '@/components/expense-row';
import { MonthNavigator } from '@/components/month-navigator';
import { MonthSummaryCard } from '@/components/month-summary-card';
import { useMonthExpenses } from '@/hooks/use-month-expenses';
import { useMonthStats } from '@/hooks/use-month-stats';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { currentMonth, parseMonthParam } from '@/lib/month';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

function Separator() {
  return <View style={styles.separator} />;
}

export default function MonthStatsScreen() {
  const { api } = useSession();
  const { month: monthParam } = useLocalSearchParams<{ month?: string }>();
  const paramMonth = parseMonthParam(monthParam);
  const [month, setMonth] = useState(paramMonth ?? currentMonth());
  // Adjust state while rendering when the param changes (no effect, no extra commit).
  const [seenParam, setSeenParam] = useState(paramMonth);
  if (paramMonth !== seenParam) {
    setSeenParam(paramMonth);
    if (paramMonth) setMonth(paramMonth);
  }
  // Consume the param so a later navigation carrying the same month is a change again.
  useEffect(() => {
    if (monthParam) router.setParams({ month: undefined });
  }, [monthParam]);

  const stats = useMonthStats(api, month);
  const list = useMonthExpenses(api, month);
  const { reload: reloadStats } = stats;
  const { reload: reloadList } = list;
  const reload = useCallback(() => {
    reloadStats();
    reloadList();
  }, [reloadStats, reloadList]);

  // Runs on first display, after a month change (reload identities change), and on every return.
  useFocusEffect(reload);

  const failed = stats.status === 'error' || list.status === 'error';
  // A response for the month just left can land before the reload resets state; never show it.
  const ready = !failed && stats.status === 'ready' && list.status === 'ready' && stats.stats?.month === month;
  const readyStats = ready ? stats.stats : null;

  return (
    <FlatList
      testID="expense-list"
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={ready ? list.items : []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ExpenseRow expense={item} onPress={() => router.push(`/expenses/${item.id}`)} />}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.header}>
          <MonthNavigator month={month} onChange={setMonth} />
          {failed ? (
            <View style={styles.state}>
              <Text style={styles.message}>{CONNECTION_ERROR}</Text>
              <Button label="다시 시도" onPress={reload} />
            </View>
          ) : readyStats ? (
            <>
              <MonthSummaryCard stats={readyStats} />
              <CategoryBreakdown categories={readyStats.categories} />
              {month === currentMonth() && <Button label="지출 기록하기" onPress={() => router.push('/expenses/new')} />}
              <Text style={styles.section}>전체 내역</Text>
            </>
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.state} />
          )}
        </View>
      }
      ListFooterComponent={
        !ready ? undefined : list.loadingMore ? (
          <ActivityIndicator color={colors.primary} style={styles.footer} />
        ) : list.moreError ? (
          <View style={styles.footer}>
            <Button label="다시 시도" onPress={list.loadMore} />
          </View>
        ) : !list.hasMore && list.items.length > 0 ? (
          <Text style={[styles.message, styles.footer]}>모든 내역을 불러왔어요</Text>
        ) : undefined
      }
      // After a failed page only the footer button retries, so layout changes can't loop requests.
      onEndReached={ready && !list.moreError ? list.loadMore : undefined}
      onEndReachedThreshold={0.5}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  content: { ...contentWidth, padding: 24, paddingBottom: 40 },
  header: { gap: 24, marginBottom: 16 },
  section: { fontSize: 18, fontFamily: fonts.bold, color: colors.text },
  state: { gap: 16, marginTop: 24 },
  separator: { height: 8 },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.muted },
  footer: { marginTop: 16 },
});
