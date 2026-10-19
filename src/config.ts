// EXPO_PUBLIC_* values are inlined into the app bundle; never put secrets here.
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || null;
// Development builds only: a non-empty value switches login to the backend fake `ok:<id>` verifier.
export const devLoginId = process.env.EXPO_PUBLIC_DEV_LOGIN_ID || null;
export const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || null;
export const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || null;
