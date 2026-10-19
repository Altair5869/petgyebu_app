import type { ConfigContext, ExpoConfig } from 'expo/config';

const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// Native login SDK plugins are added only when their keys exist, so a keyless
// checkout (CI, export) still builds without them.
const loginPlugins: NonNullable<ExpoConfig['plugins']> = [];
if (kakaoAppKey) {
  loginPlugins.push(['@react-native-seoul/kakao-login', { kakaoAppKey }]);
}
if (googleIosClientId) {
  // The iOS URL scheme is the client id's host reversed.
  const prefix = googleIosClientId.replace(/\.apps\.googleusercontent\.com$/, '');
  loginPlugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${prefix}` }]);
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'Petgyebu',
  slug: config.slug ?? 'petgyebu',
  plugins: [...(config.plugins ?? []), ...loginPlugins],
});
