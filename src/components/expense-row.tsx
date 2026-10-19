import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Expense } from '@/api/types';
import { expenseRowText } from '@/lib/expense';
import { formatWon } from '@/lib/money';

export function ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  const { title, subtitle } = expenseRowText(expense);
  const amount = formatWon(expense.amount);
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${amount}`}
    >
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  text: { flex: 1, gap: 4 },
  title: { fontSize: 16, color: '#111' },
  subtitle: { fontSize: 13, color: '#666' },
  amount: { fontSize: 16, fontWeight: '600', color: '#111' },
});
