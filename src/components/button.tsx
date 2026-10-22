import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export function Button({ label, onPress, disabled = false, loading = false, variant = 'primary' }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, variant === 'secondary' && styles.secondary, inactive && styles.inactive, pressed && styles.pressed]}>
      {loading ? <ActivityIndicator color={variant === 'secondary' ? colors.primary : colors.surface} /> : (
        <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  secondary: { backgroundColor: colors.secondary },
  secondaryLabel: { color: colors.primary },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  label: { color: colors.surface, fontSize: 17, fontFamily: fonts.bold, textAlign: 'center' },
});
