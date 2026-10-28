import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/button';
import { ForecastCard } from '@/components/forecast-card';
import { WeeklyChangeCard } from '@/components/weekly-change-card';
import { useInsights } from '@/hooks/use-insights';
import { CONNECTION_ERROR } from '@/lib/error-message';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

export default function InsightsScreen() {
  const { api } = useSession();
  const { status, insights, reload } = useInsights(api);

  // Runs on first display and on every return, so new expenses show up.
  useFocusEffect(reload);

  return (
    <ScrollView style={styles.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      {status === 'error' ? (
        <View style={styles.state}>
          <Text style={styles.message}>{CONNECTION_ERROR}</Text>
          <Button label="다시 시도" onPress={reload} />
        </View>
      ) : status === 'ready' && insights ? (
        <>
          <ForecastCard forecast={insights.forecast} />
          <WeeklyChangeCard weekly={insights.weekly} />
        </>
      ) : (
        <ActivityIndicator color={colors.primary} style={styles.state} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { ...contentWidth, padding: 24, paddingBottom: 40, gap: 16 },
  state: { gap: 16, marginTop: 24 },
  message: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', color: colors.muted },
});
