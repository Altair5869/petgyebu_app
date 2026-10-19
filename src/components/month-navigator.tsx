import { Pressable, StyleSheet, Text, View } from 'react-native';

import { canGoToNextMonth, canGoToPreviousMonth, monthTitle, nextMonth, previousMonth } from '@/lib/month';

type MonthNavigatorProps = { month: string; onChange: (month: string) => void };

function Arrow({ label, glyph, disabled, onPress }: { label: string; glyph: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={styles.arrow}>
      <Text style={[styles.glyph, disabled && styles.glyphDisabled]}>{glyph}</Text>
    </Pressable>
  );
}

export function MonthNavigator({ month, onChange }: MonthNavigatorProps) {
  return (
    <View style={styles.row}>
      <Arrow label="이전 달" glyph="‹" disabled={!canGoToPreviousMonth(month)} onPress={() => onChange(previousMonth(month))} />
      <Text style={styles.title}>{monthTitle(month)}</Text>
      <Arrow label="다음 달" glyph="›" disabled={!canGoToNextMonth(month)} onPress={() => onChange(nextMonth(month))} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '600', color: '#111' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 28, color: '#208AEF' },
  glyphDisabled: { color: '#C5CAD1' },
});
