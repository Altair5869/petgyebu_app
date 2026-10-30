import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExpenseCategory } from '@/api/types';
import { Button } from '@/components/button';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { CategoryGoalsCard } from '@/components/category-goals-card';
import { ExpenseRow } from '@/components/expense-row';
import { MonthCalendar } from '@/components/month-calendar';
import { MonthNavigator } from '@/components/month-navigator';
import { MonthSummaryCard } from '@/components/month-summary-card';
import { useCategoryGoals } from '@/hooks/use-category-goals';
import { useDailyTotals } from '@/hooks/use-daily-totals';
import { useMonthExpenses } from '@/hooks/use-month-expenses';
import { useMonthStats } from '@/hooks/use-month-stats';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { initialSelectedDay } from '@/lib/calendar';
import { formatWon } from '@/lib/money';
import { currentMonth, formatDay, parseMonthParam, todayInSeoul } from '@/lib/month';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

type StatsTab = 'calendar' | 'list';

function Separator() {
  return <View style={styles.separator} />;
}

function Tabs({ view, onChange }: { view: StatsTab; onChange: (view: StatsTab) => void }) {
  const tabs: [StatsTab, string][] = [['calendar', '달력'], ['list', '목록']];
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {tabs.map(([value, label]) => (
        <Pressable
          key={value}
          accessibilityRole="tab"
          accessibilityLabel={label}
          accessibilityState={{ selected: view === value }}
          onPress={() => onChange(value)}
          style={({ pressed }) => [styles.tab, view === value && styles.tabSelected, pressed && styles.pressed]}>
          <Text style={[styles.tabLabel, view === value && styles.tabLabelSelected]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function MonthStatsScreen() {
  const { api } = useSession();
  const { month: monthParam } = useLocalSearchParams<{ month?: string }>();
  const paramMonth = parseMonthParam(monthParam);
  const [month, setMonthState] = useState(paramMonth ?? currentMonth());
  // A new screen always opens on the list.
  const [view, setView] = useState<StatsTab>('list');
  // The day picked on the calendar; null means the default day of the month.
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const setMonth = (next: string) => {
    setMonthState(next);
    setPickedDay(null);
  };
  // Adjust state while rendering when the param changes (no effect, no extra commit).
  const [seenParam, setSeenParam] = useState(paramMonth);
  if (paramMonth !== seenParam) {
    setSeenParam(paramMonth);
    // Saving an edit comes back with the saved month; the same month keeps the picked day.
    if (paramMonth && paramMonth !== month) setMonth(paramMonth);
  }
  const selectedDay = pickedDay ?? initialSelectedDay(month);
  // Consume the param so a later navigation carrying the same month is a change again.
  useEffect(() => {
    if (monthParam) router.setParams({ month: undefined });
  }, [monthParam]);

  const stats = useMonthStats(api, month);
  const list = useMonthExpenses(api, month);
  const goals = useCategoryGoals(api, month);
  const { reload: reloadStats } = stats;
  const { reload: reloadList } = list;
  const { reload: reloadGoals } = goals;
  const reload = useCallback(() => {
    reloadStats();
    reloadList();
    reloadGoals();
  }, [reloadStats, reloadList, reloadGoals]);

  // Runs on first display, after a month change (reload identities change), and on every return.
  // Each tab loads only its own data.
  useFocusEffect(useCallback(() => {
    if (view === 'list') reload();
  }, [view, reload]));

  const totals = useDailyTotals(api, month);
  const day = useMonthExpenses(api, month, undefined, selectedDay);
  const { reload: reloadTotals } = totals;
  const { reload: reloadDay } = day;
  // Separate so picking a day reloads only that day's list, not the calendar.
  useFocusEffect(useCallback(() => {
    if (view === 'calendar') reloadTotals();
  }, [view, reloadTotals]));
  useFocusEffect(useCallback(() => {
    if (view === 'calendar') reloadDay();
  }, [view, reloadDay]));
  const reloadCalendar = () => {
    reloadTotals();
    reloadDay();
  };

  const failed = stats.status === 'error' || list.status === 'error' || goals.status === 'error';
  // A response for the month just left can land before the reload resets state; never show it.
  const ready =
    !failed &&
    stats.status === 'ready' &&
    list.status === 'ready' &&
    goals.status === 'ready' &&
    stats.stats?.month === month &&
    goals.goals?.month === month;
  const readyStats = ready ? stats.stats : null;
  const readyGoals = ready ? goals.goals : null;
  const selectCategory = (category: ExpenseCategory) =>
    router.push({ pathname: '/expenses/by-category', params: { month, category } });
  const editBudget = () => router.push({ pathname: '/settings/budget', params: { month } });
  const openExpense = (id: number) => router.push(`/expenses/${id}`);

  const navigator = (
    <>
      <MonthNavigator month={month} onChange={setMonth} />
      <Tabs view={view} onChange={setView} />
    </>
  );
  const retryState = (onRetry: () => void) => (
    <View style={styles.state}>
      <Text style={styles.message}>{CONNECTION_ERROR}</Text>
      <Button label="다시 시도" onPress={onRetry} />
    </View>
  );
  const pageFooter = (page: typeof list, ended: string | undefined) =>
    page.loadingMore ? (
      <ActivityIndicator color={colors.primary} style={styles.footer} />
    ) : page.moreError ? (
      <View style={styles.footer}>
        <Button label="다시 시도" onPress={page.loadMore} />
      </View>
    ) : ended && !page.hasMore && page.items.length > 0 ? (
      <Text style={[styles.message, styles.footer]}>{ended}</Text>
    ) : undefined;

  if (view === 'calendar') {
    const calendarFailed = totals.status === 'error';
    const readyTotals = !calendarFailed && totals.status === 'ready' && totals.totals?.month === month ? totals.totals : null;
    const dayReady = readyTotals !== null && day.status === 'ready';
    const amounts = new Map(readyTotals?.days.map((d) => [d.date, d.spentAmount]));
    const dayAmount = amounts.get(selectedDay);
    return (
      <FlatList
        testID="expense-list"
        style={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        data={dayReady ? day.items : []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ExpenseRow expense={item} onPress={() => openExpense(item.id)} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.header}>
            {navigator}
            {calendarFailed ? (
              retryState(reloadCalendar)
            ) : readyTotals ? (
              <>
                <MonthCalendar
                  month={month}
                  today={todayInSeoul()}
                  amounts={amounts}
                  selected={selectedDay}
                  onSelect={setPickedDay}
                />
                <Text style={styles.section}>
                  {dayAmount === undefined ? formatDay(selectedDay) : `${formatDay(selectedDay)} · ${formatWon(dayAmount)}`}
                </Text>
                {day.status === 'error' ? retryState(reloadDay) : !dayReady && <ActivityIndicator color={colors.primary} />}
              </>
            ) : (
              <ActivityIndicator color={colors.primary} style={styles.state} />
            )}
          </View>
        }
        ListEmptyComponent={dayReady ? <Text style={styles.message}>이날은 지출이 없어요</Text> : undefined}
        ListFooterComponent={dayReady ? pageFooter(day, undefined) : undefined}
        onEndReached={dayReady && !day.moreError ? day.loadMore : undefined}
        onEndReachedThreshold={0.5}
      />
    );
  }

  return (
    <FlatList
      testID="expense-list"
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={ready ? list.items : []}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ExpenseRow expense={item} onPress={() => openExpense(item.id)} />}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.header}>
          {navigator}
          {failed ? (
            retryState(reload)
          ) : readyStats && readyGoals ? (
            <>
              <MonthSummaryCard stats={readyStats} onEditBudget={editBudget} />
              <CategoryGoalsCard
                goals={readyGoals}
                onEditGoals={() => router.push({ pathname: '/goals', params: { month } })}
                onAddBudget={editBudget}
                onSelect={selectCategory}
              />
              <CategoryBreakdown categories={readyStats.categories} onSelect={selectCategory} />
              {month === currentMonth() && <Button label="지출 기록하기" onPress={() => router.push('/expenses/new')} />}
              <Text style={styles.section}>전체 내역</Text>
            </>
          ) : (
            <ActivityIndicator color={colors.primary} style={styles.state} />
          )}
        </View>
      }
      ListFooterComponent={ready ? pageFooter(list, '모든 내역을 불러왔어요') : undefined}
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
  tabs: { flexDirection: 'row', borderRadius: 16, backgroundColor: colors.secondary, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  tabSelected: { backgroundColor: colors.surface },
  tabLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  tabLabelSelected: { fontFamily: fonts.bold, color: colors.primary },
  pressed: { opacity: 0.8 },
});
