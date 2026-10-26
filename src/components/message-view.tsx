import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Button } from './button';

type MessageViewProps = { message: string; actionLabel?: string; onAction?: () => void };

export function MessageView({ message, actionLabel, onAction }: MessageViewProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction && <Button label={actionLabel} onPress={onAction} />}
    </View>
  );
}

export function LoadingView() {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, backgroundColor: colors.background },
  message: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, textAlign: 'center', color: colors.text },
});
