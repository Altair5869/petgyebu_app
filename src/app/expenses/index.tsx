import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ExpenseRow } from '@/components/expense-row';
import { LoadingView, MessageView } from '@/components/message-view';
import { useMonthExpenses } from '@/hooks/use-month-expenses';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { currentMonth, monthTitle } from '@/lib/month';
import { useSession } from '@/session/session-provider';

function Separator() {
  return <View style={styles.separator} />;
}

export default function MonthExpensesScreen() {
  const { api } = useSession();
  const month = currentMonth();
  const list = useMonthExpenses(api, month);

  // Back from the entry screen (or any return) → start over from the first page.
  useFocusEffect(list.reload);

  if (list.status === 'loading') return <LoadingView />;
  if (list.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={list.reload} />;

  const openEntry = () => router.push('/expenses/new');

  return (
    <FlatList
      testID="expense-list"
      style={styles.list}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={list.items}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => <ExpenseRow expense={item} />}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.month}>{monthTitle(month)}</Text>
          <Button label="지출 기록하기" onPress={openEntry} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.message}>아직 기록한 지출이 없어요</Text>}
      ListFooterComponent={
        list.loadingMore ? (
          <ActivityIndicator style={styles.footer} />
        ) : list.moreError ? (
          <View style={styles.footer}>
            <Button label="다시 시도" onPress={list.loadMore} />
          </View>
        ) : !list.hasMore && list.items.length > 0 ? (
          <Text style={[styles.message, styles.footer]}>모든 내역을 불러왔어요</Text>
        ) : undefined
      }
      // After a failed page only the footer button retries, so layout changes can't loop requests.
      onEndReached={list.moreError ? undefined : list.loadMore}
      onEndReachedThreshold={0.5}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  header: { gap: 16, marginBottom: 8 },
  month: { fontSize: 16, color: '#555' },
  separator: { height: 1, backgroundColor: '#EEF0F3' },
  message: { textAlign: 'center', color: '#666', marginTop: 24 },
  footer: { marginTop: 16 },
});
