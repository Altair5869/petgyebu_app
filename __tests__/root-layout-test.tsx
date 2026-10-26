import { render, screen } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';

const mockUseFonts = jest.fn();

jest.mock('expo-font', () => ({ useFonts: () => mockUseFonts() }));
jest.mock('expo-router', () => ({
  SplashScreen: { preventAutoHideAsync: jest.fn(), hide: jest.fn() },
  Stack: () => null,
}));
jest.mock('@/config', () => ({ apiBaseUrl: 'http://localhost:8080/api/v1' }));
jest.mock('@/session/session-provider', () => {
  const { Text: MockText } = jest.requireActual('react-native');
  return {
    SessionProvider: () => <MockText>session started</MockText>,
    useSession: jest.fn(),
  };
});

test('waits for the fonts before starting the session', async () => {
  mockUseFonts.mockReturnValue([false, null]);
  await render(<RootLayout />);

  expect(screen.queryByText('session started')).toBeNull();
});

test('starts the session with the system font when the fonts fail to load', async () => {
  mockUseFonts.mockReturnValue([false, new Error('font load failed')]);
  await render(<RootLayout />);

  screen.getByText('session started');
});

test('starts the session once the fonts are loaded', async () => {
  mockUseFonts.mockReturnValue([true, null]);
  await render(<RootLayout />);

  screen.getByText('session started');
});
