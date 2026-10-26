import { StyleSheet, Text, View } from 'react-native';

import type { MonthStats } from '@/api/types';
import { formatWon } from '@/lib/money';
import { summaryCells } from '@/lib/stats';
import { colors, fonts } from '@/theme';

export function MonthSummaryCard({ stats }: { stats: MonthStats }) {
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
});
