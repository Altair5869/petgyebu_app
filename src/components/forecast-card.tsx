import { StyleSheet, Text, View } from 'react-native';

import type { Forecast } from '@/api/types';
import { forecastCopy } from '@/lib/insights';
import { colors, fonts } from '@/theme';

export function ForecastCard({ forecast }: { forecast: Forecast }) {
  const copy = forecastCopy(forecast);
  if (!copy) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      {copy.detail && <Text style={styles.detail}>{copy.detail}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 24, borderRadius: 24, backgroundColor: colors.secondary },
  title: { fontSize: 20, lineHeight: 28, fontFamily: fonts.bold, color: colors.text },
  detail: { fontSize: 15, fontFamily: fonts.regular, color: colors.muted, fontVariant: ['tabular-nums'] },
});
