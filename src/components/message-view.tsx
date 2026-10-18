import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

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
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: '#fff' },
  message: { fontSize: 16, textAlign: 'center', color: '#111' },
});
