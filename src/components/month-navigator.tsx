import { Pressable, StyleSheet, Text, View } from 'react-native';

import { canGoToNextMonth, canGoToPreviousMonth, monthTitle, nextMonth, previousMonth } from '@/lib/month';
import { colors, fonts } from '@/theme';

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
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}>
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, fontSize: 20, fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  arrow: { minWidth: 48, minHeight: 48, padding: 8, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontFamily: fonts.regular, fontSize: 28, color: colors.primary },
  glyphDisabled: { color: colors.disabled },
  pressed: { opacity: 0.8 },
});
