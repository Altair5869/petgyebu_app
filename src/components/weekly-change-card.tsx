import { StyleSheet, Text, View } from 'react-native';

import type { Insights } from '@/api/types';
import { CATEGORY_LABELS } from '@/lib/expense';
import {
  barPercent,
  changeRowLabel,
  changeTone,
  formatChange,
  formatWeekRanges,
  maxWeeklyAmount,
  weeklyHeadline,
} from '@/lib/insights';
import { CATEGORY_COLORS } from '@/lib/stats';
import { colors, fonts } from '@/theme';

const DECREASE_COLOR = '#4E7A48';
const TONE_COLORS = { up: colors.danger, down: DECREASE_COLOR, none: colors.muted } as const;

export function WeeklyChangeCard({ weekly }: { weekly: Insights['weekly'] }) {
  const headline = weeklyHeadline(weekly.categories);
  if (headline.kind === 'empty') {
    return <Text style={styles.empty}>이번 주와 지난주에 기록한 지출이 없어요</Text>;
  }
  const max = maxWeeklyAmount(weekly.categories);
  return (
    <>
      <View style={styles.card}>
        <Text testID="weekly-headline" style={styles.headline}>
          {headline.kind === 'increased' ? (
            <>
              {'이번 주에는 지난주보다 '}
              <Text style={styles.bold}>{headline.categoryLabel}</Text>
              {'에 '}
              <Text style={[styles.bold, styles.increase]}>{headline.amountText}</Text>
              {' 더 썼어요'}
            </>
          ) : (
            '이번 주에는 지난주보다 늘어난 지출이 없어요'
          )}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>카테고리별 변화</Text>
        <Text style={styles.ranges}>{formatWeekRanges(weekly.thisWeek, weekly.lastWeek)}</Text>
        {weekly.categories.map((c) => (
          <View key={c.category} accessible accessibilityLabel={changeRowLabel(c)} testID={`weekly-row-${c.category}`} style={styles.row}>
            <Text style={styles.name}>{CATEGORY_LABELS[c.category]}</Text>
            <View style={styles.bars}>
              <View
                testID={`this-week-bar-${c.category}`}
                style={[styles.bar, { width: `${barPercent(c.thisWeekAmount, max)}%`, backgroundColor: CATEGORY_COLORS[c.category] }]}
              />
              <View
                testID={`last-week-bar-${c.category}`}
                style={[styles.bar, { width: `${barPercent(c.lastWeekAmount, max)}%`, backgroundColor: colors.border }]}
              />
            </View>
            <Text style={[styles.change, { color: TONE_COLORS[changeTone(c.changeAmount)] }]}>{formatChange(c.changeAmount)}</Text>
          </View>
        ))}
        <Text style={styles.legend}>색 막대 이번 주 · 회색 막대 지난주</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: 16, padding: 24, borderRadius: 24, backgroundColor: colors.surface },
  headline: { fontSize: 17, lineHeight: 26, fontFamily: fonts.regular, color: colors.text },
  bold: { fontFamily: fonts.bold },
  increase: { color: colors.danger },
  label: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  ranges: { fontSize: 14, fontFamily: fonts.regular, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { minWidth: 56, flexShrink: 0, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  bars: { flex: 1, gap: 4 },
  bar: { height: 8, borderRadius: 4 },
  change: { minWidth: 64, flexShrink: 0, textAlign: 'right', fontFamily: fonts.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  legend: { fontSize: 13, fontFamily: fonts.regular, color: colors.muted },
  empty: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, textAlign: 'center', padding: 24, borderRadius: 24, backgroundColor: colors.surface },
});
