import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import type { Provider } from '@/api/types';

type SocialLoginButtonProps = {
  provider: Provider;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
};

// Kakao and Google brand guides fix the label, colors and logo, so these are not theme values.
const BRAND = {
  kakao: {
    label: '카카오 로그인',
    logo: require('../../assets/images/kakao-symbol.png'),
    logoSize: 24,
    labelColor: 'rgba(0, 0, 0, 0.85)',
    style: { backgroundColor: '#FEE500' },
  },
  google: {
    label: 'Google로 로그인',
    logo: require('../../assets/images/google-g.png'),
    logoSize: 20,
    labelColor: '#1F1F1F',
    style: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#747775' },
  },
} as const;

export function SocialLoginButton({ provider, onPress, loading, disabled }: SocialLoginButtonProps) {
  const brand = BRAND[provider];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={brand.label}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        brand.style,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={brand.labelColor} />
      ) : (
        <>
          <Image
            source={brand.logo}
            style={{ width: brand.logoSize, height: brand.logoSize }}
            accessible={false}
          />
          <Text style={[styles.label, { color: brand.labelColor }]}>{brand.label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.8 },
  label: { flexShrink: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
