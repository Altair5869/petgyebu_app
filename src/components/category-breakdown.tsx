import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryStat, ExpenseCategory } from '@/api/types';
import { CATEGORY_LABELS } from '@/lib/expense';
import { formatWon } from '@/lib/money';
import { CATEGORY_COLORS } from '@/lib/stats';
import { colors, fonts } from '@/theme';

type Props = { categories: CategoryStat[]; onSelect?: (category: ExpenseCategory) => void };

export function CategoryBreakdown({ categories, onSelect }: Props) {
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
      {categories.map((c) => {
        const value = `${formatWon(c.spentAmount)} · ${c.sharePercent}%`;
        const content = (
          <>
            <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[c.category] }]} />
            <Text style={styles.name}>{CATEGORY_LABELS[c.category]}</Text>
            <Text style={styles.value}>{value}</Text>
            {onSelect && <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.chevron}>›</Text>}
          </>
        );
        return onSelect ? (
          <Pressable
            key={c.category}
            accessibilityRole="button"
            accessibilityLabel={`${CATEGORY_LABELS[c.category]} ${value}`}
            onPress={() => onSelect(c.category)}
            style={({ pressed }) => [styles.row, styles.rowButton, pressed && styles.pressed]}>
            {content}
          </Pressable>
        ) : (
          <View key={c.category} style={styles.row}>
            {content}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16, padding: 24, borderRadius: 24, backgroundColor: colors.surface },
  label: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  bar: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.border },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  rowButton: { minHeight: 44 },
  pressed: { opacity: 0.8 },
  chevron: { fontFamily: fonts.regular, fontSize: 18, color: colors.muted },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { flexGrow: 1, flexBasis: 72, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  value: { maxWidth: '100%', marginLeft: 'auto', fontFamily: fonts.regular, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  empty: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: 'center', padding: 24, borderRadius: 24, backgroundColor: colors.surface },
});
