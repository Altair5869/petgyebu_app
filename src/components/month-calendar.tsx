import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calendarCells, formatDayAmount, WEEKDAYS } from '@/lib/calendar';
import { formatWon } from '@/lib/money';
import { formatDay } from '@/lib/month';
import { colors, fonts } from '@/theme';

type MonthCalendarProps = {
  month: string;
  today: string;
  // Day totals by YYYY-MM-DD; days without spending are absent.
  amounts: Map<string, number>;
  selected: string;
  onSelect: (day: string) => void;
};

// Seven columns leave no room for larger text: two-digit dates would wrap. The day title below the
// grid keeps full scaling, and each cell's label carries the exact amount.
const GRID_MAX_FONT_SCALE = 1.5;

export function MonthCalendar({ month, today, amounts, selected, onSelect }: MonthCalendarProps) {
  return (
    <View style={styles.card}>
      <View style={styles.week}>
        {WEEKDAYS.map((weekday) => (
          <Text
            key={weekday}
            style={[styles.cell, styles.weekday]}
            maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}
            importantForAccessibility="no" accessibilityElementsHidden>
            {weekday}
          </Text>
        ))}
      </View>
      <View style={styles.week}>
        {calendarCells(month).map((day, index) => {
          if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
          const amount = amounts.get(day);
          const isSelected = day === selected;
          const isToday = day === today;
          const label = [formatDay(day), isToday && '오늘', amount === undefined ? '지출 없음' : formatWon(amount)]
            .filter(Boolean)
            .join(', ');
          return (
            <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onSelect(day)}
              style={({ pressed }) => [styles.cell, styles.day, pressed && styles.pressed]}>
              <View style={[styles.date, isToday && styles.today, isSelected && styles.selected]}>
                <Text
                  style={[styles.dateText, isToday && styles.todayText, isSelected && styles.selectedText]}
                  maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>
                  {Number(day.slice(8))}
                </Text>
              </View>
              <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={GRID_MAX_FONT_SCALE}>
                {amount === undefined ? '' : formatDayAmount(amount)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.surface, paddingVertical: 16, paddingHorizontal: 8, gap: 8 },
  week: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center' },
  weekday: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, textAlign: 'center' },
  day: { minHeight: 56, paddingVertical: 4, gap: 2 },
  date: { minWidth: 32, minHeight: 32, paddingHorizontal: 4, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 1.5, borderColor: colors.primary },
  selected: { backgroundColor: colors.primary },
  dateText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  todayText: { fontFamily: fonts.bold, color: colors.primary },
  selectedText: { fontFamily: fonts.bold, color: colors.surface },
  amount: { minHeight: 16, fontFamily: fonts.regular, fontSize: 11, color: colors.primary, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.8 },
});
