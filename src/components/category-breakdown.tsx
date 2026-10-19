import { StyleSheet, Text, View } from 'react-native';

import type { CategoryStat } from '@/api/types';
import { CATEGORY_LABELS } from '@/lib/expense';
import { formatWon } from '@/lib/money';
import { CATEGORY_COLORS } from '@/lib/stats';

export function CategoryBreakdown({ categories }: { categories: CategoryStat[] }) {
  if (categories.length === 0) {
    return <Text style={styles.empty}>이 달에는 기록한 지출이 없어요</Text>;
  }
  return (
    <View style={styles.section}>
      <Text style={styles.label}>카테고리</Text>
      <View style={styles.bar}>
        {categories.map((c) => (
          <View
            key={c.category}
            testID={`category-bar-${c.category}`}
            style={{ flex: c.sharePercent, backgroundColor: CATEGORY_COLORS[c.category] }}
          />
        ))}
      </View>
      {categories.map((c) => (
        <View key={c.category} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[c.category] }]} />
          <Text style={styles.name}>{CATEGORY_LABELS[c.category]}</Text>
          <Text style={styles.value}>{`${formatWon(c.spentAmount)} · ${c.sharePercent}%`}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  label: { fontSize: 13, color: '#666' },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#EEF1F5' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flex: 1, fontSize: 15, color: '#111' },
  value: { fontSize: 15, color: '#444' },
  empty: { fontSize: 14, color: '#666', textAlign: 'center', paddingVertical: 24 },
});
