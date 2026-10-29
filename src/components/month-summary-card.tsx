import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MonthStats } from '@/api/types';
import { formatWon } from '@/lib/money';
import { monthName } from '@/lib/month';
import { summaryCells } from '@/lib/stats';
import { colors, fonts } from '@/theme';

export function MonthSummaryCard({ stats, onEditBudget }: { stats: MonthStats; onEditBudget?: () => void }) {
  const name = monthName(stats.month);
  const amount = stats.budgetAmount === null ? '미설정' : formatWon(stats.budgetAmount);
  const link = stats.budgetAmount === null ? '넣기 ›' : '고치기 ›';
  return (
    <View style={styles.card}>
      <Text style={styles.label}>총 지출</Text>
      <Text style={styles.total}>{formatWon(stats.spentAmount)}</Text>
      <View style={styles.cells}>
        {summaryCells(stats).map((cell) => (
          <View key={cell.label} style={styles.cell}>
            <Text style={styles.cellLabel}>{cell.label}</Text>
            <Text style={styles.cellValue}>
              {cell.value}
            </Text>
          </View>
        ))}
      </View>
      {onEditBudget && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} 예산 ${amount}, ${link.replace(' ›', '')}`}
          onPress={onEditBudget}
          style={({ pressed }) => [styles.budgetRow, pressed && styles.pressed]}>
          <View style={styles.budgetLeft}>
            <Text style={styles.budgetText}>{`${name} 예산`}</Text>
            <Text style={styles.budgetAmount}>{amount}</Text>
          </View>
          <Text style={styles.link}>{link}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, gap: 12 },
  label: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  total: { fontSize: 34, fontFamily: fonts.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  cell: { flexGrow: 1, flexBasis: 120, backgroundColor: colors.background, borderRadius: 16, padding: 12, gap: 8 },
  cellLabel: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  cellValue: { fontSize: 16, fontFamily: fonts.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  budgetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 12 },
  budgetLeft: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  budgetText: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  budgetAmount: { fontSize: 15, fontFamily: fonts.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  link: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  pressed: { opacity: 0.8 },
});
