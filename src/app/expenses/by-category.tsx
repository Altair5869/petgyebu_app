import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import type { ExpenseCategory } from '@/api/types';
import { Button } from '@/components/button';
import { ExpenseRow } from '@/components/expense-row';
import { MessageView } from '@/components/message-view';
import { useCategoryGoals } from '@/hooks/use-category-goals';
import { useMonthExpenses } from '@/hooks/use-month-expenses';
import { useMonthStats } from '@/hooks/use-month-stats';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { CATEGORY_LABELS, parseCategoryParam } from '@/lib/expense';
import { goalRemaining, goalSummaryText } from '@/lib/goals';
import { monthName, parseMonthParam } from '@/lib/month';
import { formatWon } from '@/lib/money';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

function Separator() {
  return <View style={styles.separator} />;
}

export default function CategoryExpensesScreen() {
  const params = useLocalSearchParams<{ month?: string; category?: string }>();
  const month = parseMonthParam(params.month);
  const category = parseCategoryParam(params.category);
  if (!month || !category) {
    return <MessageView message="잘못된 접근이에요" actionLabel="뒤로" onAction={() => router.back()} />;
  }
  return <CategoryExpenses month={month} category={category} />;
}

function CategoryExpenses({ month, category }: { month: string; category: ExpenseCategory }) {
  const { api } = useSession();
  const stats = useMonthStats(api, month);
  const goals = useCategoryGoals(api, month);
  const list = useMonthExpenses(api, month, category);
  const { reload: reloadStats } = stats;
  const { reload: reloadGoals } = goals;
  const { reload: reloadList } = list;
  const reload = useCallback(() => {
    reloadStats();
    reloadGoals();
    reloadList();
  }, [reloadStats, reloadGoals, reloadList]);

  // Runs on first display and on every return from the edit screen.
  useFocusEffect(reload);

  const failed = stats.status === 'error' || goals.status === 'error' || list.status === 'error';
  const ready =
    !failed &&
    stats.status === 'ready' &&
    goals.status === 'ready' &&
    list.status === 'ready' &&
    stats.stats?.month === month &&
    goals.goals?.month === month;
  const spent = stats.stats?.categories.find((c) => c.category === category)?.spentAmount ?? 0;
  const goal = goals.goals?.goals.find((g) => g.category === category);

  return (
    <FlatList
      testID="expense-list"
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={ready ? list.items : []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <ExpenseRow
          expense={item}
          onPress={() => router.push({ pathname: '/expenses/[id]', params: { id: item.id, from: 'category' } })}
        />
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.header}>
          {failed ? (
            <View style={styles.state}>
              <Text style={styles.message}>{CONNECTION_ERROR}</Text>
              <Button label="다시 시도" onPress={reload} />
            </View>
          ) : ready ? (
            <View style={styles.summary}>
              <Text style={styles.title}>{`${monthName(month)} ${CATEGORY_LABELS[category]}`}</Text>
              <Text style={styles.amount}>{formatWon(spent)}</Text>
              {goal && (
                <Text style={[styles.goal, goalRemaining(goal.remainingAmount).over && styles.over]}>
                  {goalSummaryText(goal)}
                </Text>
              )}
            </View>
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.state} />
          )}
        </View>
      }
      ListEmptyComponent={
        ready ? <Text style={styles.message}>이 달에 이 카테고리 지출이 없어요</Text> : undefined
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
  summary: { gap: 4 },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.muted },
  amount: { fontSize: 32, fontFamily: fonts.bold, color: colors.text },
  goal: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  over: { color: colors.danger },
  state: { gap: 16, marginTop: 24 },
  separator: { height: 8 },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.muted },
  footer: { marginTop: 16 },
});
