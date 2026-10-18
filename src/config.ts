// EXPO_PUBLIC_* values are inlined into the app bundle; never put secrets here.
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || null;
export const devLoginId = process.env.EXPO_PUBLIC_DEV_LOGIN_ID || 'dev-user';
