import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { InteractiveCat } from '@/components/interactive-cat';

jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: Object.assign(View, { loadAsync: jest.fn() }) };
});

const SEEN = { includeHiddenElements: true };
const listeners = new Map<string, (value: never) => void>();
const originalAppState = AppState.currentState;
beforeEach(() => {
  jest.useFakeTimers();
  AppState.currentState = 'active';
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((name, fn) => {
    listeners.set(name, fn);
    return { remove: () => listeners.delete(name) };
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((name, fn) => {
    listeners.set(name, fn);
    return { remove: () => listeners.delete(name) };
  });
  jest.mocked(Image.loadAsync).mockResolvedValue({} as never);
});
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); listeners.clear(); AppState.currentState = originalAppState; });

test('home stays 155×120 during petting and returns to the latest budget state', async () => {
  const view = await render(<InteractiveCat petState="STABLE" focused />);
  await waitFor(() => expect(screen.getByTestId('cat-head')).toBeEnabled());
  await fireEvent(screen.getByTestId('cat-head'), 'pressIn');
  await act(() => jest.advanceTimersByTime(100));
  screen.getByTestId('cat-frame-STABLE-closed', SEEN);
  expect(StyleSheet.flatten(screen.getByTestId('interactive-cat').props.style)).toMatchObject({ width: 155, height: 120 });
  await view.rerender(<InteractiveCat petState="CAUTION" focused />);
  screen.getByTestId('cat-frame-STABLE-closed', SEEN);
  await fireEvent(screen.getByTestId('cat-head'), 'pressOut');
  await act(() => jest.advanceTimersByTime(240));
  await waitFor(() => screen.getByTestId('cat-frame-CAUTION-open', SEEN));
});

test('route blur, app background and touch cancellation end the response', async () => {
  const view = await render(<InteractiveCat petState="WARNING" focused />);
  await waitFor(() => expect(screen.getByTestId('cat-head')).toBeEnabled());
  await fireEvent(screen.getByTestId('cat-head'), 'pressIn');
  await view.rerender(<InteractiveCat petState="WARNING" focused={false} />);
  screen.getByTestId('cat-frame-WARNING-open', SEEN);
  await act(() => jest.advanceTimersByTime(8000));
  screen.getByTestId('cat-frame-WARNING-open', SEEN);
  await view.rerender(<InteractiveCat petState="WARNING" focused />);
  await fireEvent(screen.getByTestId('cat-head'), 'pressIn');
  await act(() => listeners.get('change')?.('background' as never));
  screen.getByTestId('cat-frame-WARNING-open', SEEN);
  expect(screen.getByTestId('cat-head')).toBeDisabled();
  await act(() => listeners.get('change')?.('active' as never));
  await fireEvent(screen.getByTestId('cat-head'), 'pressIn');
  await fireEvent(screen.getByTestId('cat-head'), 'touchCancel');
  screen.getByTestId('cat-frame-WARNING-open', SEEN);
  await view.unmount();
  expect(listeners.size).toBe(0);
});

test('decode failure keeps the static original and disables interaction', async () => {
  jest.mocked(Image.loadAsync).mockRejectedValue(new Error('decode failed'));
  await render(<InteractiveCat petState="CAUTION" focused />);
  await act(async () => {});
  screen.getByTestId('pet-image', SEEN);
  expect(screen.getByTestId('cat-head')).toBeDisabled();
});

test('iOS only subscribes to supported AppState change events', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  await render(<InteractiveCat petState="STABLE" focused />);
  expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  expect(AppState.addEventListener).not.toHaveBeenCalledWith('blur', expect.anything());
  expect(AppState.addEventListener).not.toHaveBeenCalledWith('focus', expect.anything());
});

test('Android focus loss stops interaction until focus returns', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  await render(<InteractiveCat petState="STABLE" focused />);
  await waitFor(() => expect(screen.getByTestId('cat-head')).toBeEnabled());
  await fireEvent(screen.getByTestId('cat-head'), 'pressIn');
  await act(() => listeners.get('blur')?.(undefined as never));
  expect(screen.getByTestId('cat-head')).toBeDisabled();
  screen.getByTestId('cat-frame-STABLE-open', SEEN);
  await act(() => listeners.get('focus')?.(undefined as never));
  expect(screen.getByTestId('cat-head')).toBeEnabled();
});

test('reduce-motion changes stop idle and a screen reader press can still react', async () => {
  await render(<InteractiveCat petState="STABLE" focused />);
  await waitFor(() => expect(screen.getByTestId('cat-head')).toBeEnabled());
  await act(() => listeners.get('reduceMotionChanged')?.(true as never));
  await act(() => jest.advanceTimersByTime(8000));
  screen.getByTestId('cat-frame-STABLE-open', SEEN);
  await fireEvent.press(screen.getByRole('button', { name: '고양이 쓰다듬기' }));
  screen.getByTestId('cat-frame-STABLE-closed', SEEN);
  await act(() => jest.advanceTimersByTime(850));
  screen.getByTestId('cat-frame-STABLE-open', SEEN);
});
