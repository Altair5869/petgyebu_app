import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';

import { useLastFieldScroll } from '@/hooks/use-last-field-scroll';

async function setup(os: string, keyboardVisible: boolean) {
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(keyboardVisible);
  const scrollToEnd = jest.fn();
  const { result } = await renderHook(() => useLastFieldScroll(os));
  result.current.scrollRef.current = { scrollToEnd } as never;
  return { result, scrollToEnd };
}

afterEach(() => jest.restoreAllMocks());

describe('on Android', () => {
  test('scrolls to the end when the keyboard shrinks the view while the last field is focused', async () => {
    const { result, scrollToEnd } = await setup('android', true);
    await act(() => result.current.lastField.onFocus());
    scrollToEnd.mockClear();
    await act(() => result.current.onScrollLayout());
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  test('scrolls right away when the keyboard is already open on focus', async () => {
    const { result, scrollToEnd } = await setup('android', true);
    await act(() => result.current.lastField.onFocus());
    expect(scrollToEnd).toHaveBeenCalledTimes(1);
  });

  test('waits for the layout when the keyboard is still closed on focus', async () => {
    const { result, scrollToEnd } = await setup('android', false);
    await act(() => result.current.lastField.onFocus());
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  test('does not scroll on layout after the last field loses focus', async () => {
    const { result, scrollToEnd } = await setup('android', true);
    await act(() => result.current.lastField.onFocus());
    await act(() => result.current.lastField.onBlur());
    scrollToEnd.mockClear();
    await act(() => result.current.onScrollLayout());
    expect(scrollToEnd).not.toHaveBeenCalled();
  });

  test('does not scroll on layout when another field is focused', async () => {
    const { result, scrollToEnd } = await setup('android', true);
    await act(() => result.current.onScrollLayout());
    expect(scrollToEnd).not.toHaveBeenCalled();
  });
});

test('never scrolls on iOS, where the scroll view already keeps the focused field visible', async () => {
  const { result, scrollToEnd } = await setup('ios', true);
  await act(() => result.current.lastField.onFocus());
  await act(() => result.current.onScrollLayout());
  expect(scrollToEnd).not.toHaveBeenCalled();
});
