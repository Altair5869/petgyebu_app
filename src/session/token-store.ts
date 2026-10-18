import * as SecureStore from 'expo-secure-store';

import type { TokenStore } from '@/api/client';

const REFRESH_TOKEN_KEY = 'petgyebu.refreshToken';

export const secureTokenStore: TokenStore = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  setRefreshToken: (token) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
