import { StyleSheet, Text, View } from 'react-native';

import type { MonthStats } from '@/api/types';
import { formatWon } from '@/lib/money';
import { summaryCells } from '@/lib/stats';

export function MonthSummaryCard({ stats }: { stats: MonthStats }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>총 지출</Text>
      <Text style={styles.total}>{formatWon(stats.spentAmount)}</Text>
      <View style={styles.cells}>
        {summaryCells(stats).map((cell) => (
          <View key={cell.label} style={styles.cell}>
            <Text style={styles.cellLabel}>{cell.label}</Text>
            {/* Three cells share one row; a long amount shrinks instead of wrapping. */}
            <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {cell.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F5F8FC', borderRadius: 16, padding: 16, gap: 6 },
  label: { fontSize: 13, color: '#666' },
  total: { fontSize: 32, fontWeight: '700', color: '#111', marginBottom: 10 },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, gap: 4 },
  cellLabel: { fontSize: 12, color: '#666' },
  cellValue: { fontSize: 15, fontWeight: '600', color: '#111' },
});
