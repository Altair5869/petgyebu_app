import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Expense } from '@/api/types';
import { expenseRowText } from '@/lib/expense';
import { formatWon } from '@/lib/money';
import { colors, fonts } from '@/theme';

export function ExpenseRow({ expense, onPress }: { expense: Expense; onPress: () => void }) {
  const { title, subtitle } = expenseRowText(expense);
  const amount = formatWon(expense.amount);
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}, ${amount}`}
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
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: colors.surface },
  text: { flexGrow: 1, flexShrink: 1, flexBasis: 120, gap: 4 },
  title: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  amount: { maxWidth: '100%', marginLeft: 'auto', fontSize: 16, fontFamily: fonts.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.8 },
});
