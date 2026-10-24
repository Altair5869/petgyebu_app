import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, Platform, StyleSheet } from 'react-native';
import { Image } from 'expo-image';

import { InteractivePet } from '@/components/interactive-pet';

jest.mock('expo-image', () => {
  const { View } = jest.requireActual('react-native');
  return { Image: Object.assign(View, { loadAsync: jest.fn() }) };
});

const SEEN = { includeHiddenElements: true };
const listeners = new Map<string, (value: never) => void>();
const originalAppState = AppState.currentState;
beforeEach(() => {
  jest.clearAllMocks();
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

describe.each(['CAT', 'DOG'] as const)('%s interaction', (petType) => {
  const id = petType.toLowerCase();
  const name = petType === 'CAT' ? '고양이' : '강아지';

  test('announces the species-specific petting hint', async () => {
    await render(<InteractivePet petType={petType} petState="STABLE" focused />);
    expect(screen.getByRole('button', { name: `${name} 쓰다듬기` }).props.accessibilityHint).toBe(
      petType === 'CAT' ? '머리를 쓰다듬으면 잠깐 눈을 감아요' : '머리를 쓰다듬으면 잠깐 편안한 눈매가 돼요',
    );
  });

  test('static fallback and decoded frame keep the same home bounds', async () => {
    let resolveFrame!: (value: never) => void;
    // All three requests share the same pending decode in this test.
    const pending = new Promise<never>((resolve) => { resolveFrame = resolve; });
    jest.mocked(Image.loadAsync).mockReturnValue(pending);
    await render(<InteractivePet petType={petType} petState="STABLE" focused />);
    const fallback = StyleSheet.flatten(screen.getByTestId('pet-image', SEEN).props.style);
    expect(fallback).toMatchObject({ width: 155, height: 120, alignSelf: 'center' });
    await act(async () => resolveFrame({} as never));
    const frame = await screen.findByTestId(`${id}-frame-STABLE-open`, SEEN);
    expect(StyleSheet.flatten(frame.props.style)).toEqual(fallback);
    expect(frame.props.contentFit).toBe('contain');
  });

  test.each(['STABLE', 'CAUTION', 'WARNING', 'BUDGET_REACHED'] as const)('%s returns to its budget expression after petting', async (petState) => {
    await render(<InteractivePet petType={petType} petState={petState} focused />);
    await waitFor(() => expect(screen.getByTestId(`${id}-head`)).toBeEnabled());
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressIn');
    await act(() => jest.advanceTimersByTime(100));
    screen.getByTestId(`${id}-frame-${petState}-closed`, SEEN);
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressOut');
    await act(() => jest.advanceTimersByTime(240));
    screen.getByTestId(`${id}-frame-${petState}-open`, SEEN);
  });
  test('home stays 155×120 during petting and returns to the latest budget state', async () => {
    const view = await render(<InteractivePet petType={petType} petState="STABLE" focused />);
    await waitFor(() => expect(screen.getByTestId(`${id}-head`)).toBeEnabled());
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressIn');
    await act(() => jest.advanceTimersByTime(100));
    screen.getByTestId(`${id}-frame-STABLE-closed`, SEEN);
    expect(StyleSheet.flatten(screen.getByTestId(`interactive-${id}`).props.style)).toMatchObject({ width: 155, height: 120 });
    await view.rerender(<InteractivePet petType={petType} petState="CAUTION" focused />);
    screen.getByTestId(`${id}-frame-STABLE-closed`, SEEN);
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressOut');
    await act(() => jest.advanceTimersByTime(240));
    await waitFor(() => screen.getByTestId(`${id}-frame-CAUTION-open`, SEEN));
  });

  test('route blur, app background and touch cancellation end the response', async () => {
    const view = await render(<InteractivePet petType={petType} petState="WARNING" focused />);
    await waitFor(() => expect(screen.getByTestId(`${id}-head`)).toBeEnabled());
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressIn');
    await view.rerender(<InteractivePet petType={petType} petState="WARNING" focused={false} />);
    screen.getByTestId(`${id}-frame-WARNING-open`, SEEN);
    await act(() => jest.advanceTimersByTime(8000));
    screen.getByTestId(`${id}-frame-WARNING-open`, SEEN);
    await view.rerender(<InteractivePet petType={petType} petState="WARNING" focused />);
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressIn');
    await act(() => listeners.get('change')?.('background' as never));
    screen.getByTestId(`${id}-frame-WARNING-open`, SEEN);
    expect(screen.getByTestId(`${id}-head`)).toBeDisabled();
    await act(() => listeners.get('change')?.('active' as never));
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressIn');
    await fireEvent(screen.getByTestId(`${id}-head`), 'touchCancel');
    screen.getByTestId(`${id}-frame-WARNING-open`, SEEN);
    await view.unmount();
    expect(listeners.size).toBe(0);
  });

  test('decode failure keeps the static original and disables interaction', async () => {
    jest.mocked(Image.loadAsync).mockRejectedValue(new Error('decode failed'));
    await render(<InteractivePet petType={petType} petState="CAUTION" focused />);
    await act(async () => {});
    screen.getByTestId('pet-image', SEEN);
    expect(screen.getByTestId(`${id}-head`)).toBeDisabled();
  });

  test('iOS only subscribes to supported AppState change events', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<InteractivePet petType={petType} petState="STABLE" focused />);
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(AppState.addEventListener).not.toHaveBeenCalledWith('blur', expect.anything());
    expect(AppState.addEventListener).not.toHaveBeenCalledWith('focus', expect.anything());
  });

  test('Android focus loss stops interaction until focus returns', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    await render(<InteractivePet petType={petType} petState="STABLE" focused />);
    await waitFor(() => expect(screen.getByTestId(`${id}-head`)).toBeEnabled());
    await fireEvent(screen.getByTestId(`${id}-head`), 'pressIn');
    await act(() => listeners.get('blur')?.(undefined as never));
    expect(screen.getByTestId(`${id}-head`)).toBeDisabled();
    screen.getByTestId(`${id}-frame-STABLE-open`, SEEN);
    await act(() => listeners.get('focus')?.(undefined as never));
    expect(screen.getByTestId(`${id}-head`)).toBeEnabled();
  });

  test('reduce-motion changes stop idle and a screen reader press can still react', async () => {
    await render(<InteractivePet petType={petType} petState="STABLE" focused />);
    await waitFor(() => expect(screen.getByTestId(`${id}-head`)).toBeEnabled());
    await act(() => listeners.get('reduceMotionChanged')?.(true as never));
    await act(() => jest.advanceTimersByTime(8000));
    screen.getByTestId(`${id}-frame-STABLE-open`, SEEN);
    await fireEvent.press(screen.getByRole('button', { name: `${name} 쓰다듬기` }));
    screen.getByTestId(`${id}-frame-STABLE-closed`, SEEN);
    await act(() => jest.advanceTimersByTime(850));
    screen.getByTestId(`${id}-frame-STABLE-open`, SEEN);
  });

});

test('changing species during petting cancels the old reaction', async () => {
  const view = await render(<InteractivePet petType="CAT" petState="CAUTION" focused />);
  await waitFor(() => expect(screen.getByTestId('cat-head')).toBeEnabled());
  await fireEvent(screen.getByTestId('cat-head'), 'pressIn');
  await act(() => jest.advanceTimersByTime(100));
  screen.getByTestId('cat-frame-CAUTION-closed', SEEN);
  await view.rerender(<InteractivePet petType="DOG" petState="WARNING" focused />);
  await waitFor(() => screen.getByTestId('dog-frame-WARNING-open', SEEN));
  expect(screen.queryByTestId('cat-head')).toBeNull();
  await act(() => jest.advanceTimersByTime(1000));
  screen.getByTestId('dog-frame-WARNING-open', SEEN);
});
