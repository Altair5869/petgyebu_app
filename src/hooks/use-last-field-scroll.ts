import { type ComponentRef, useRef } from 'react';
import { Keyboard, Platform, type ScrollView } from 'react-native';

// On Android the scroll view scrolls to a focused field before the keyboard avoider shrinks it, so
// the last field ends up behind the keyboard. Scroll to the end again once the view has shrunk.
export function useLastFieldScroll(os: string = Platform.OS) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const focused = useRef(false);
  const enabled = os === 'android';

  function scrollIfFocused() {
    if (enabled && focused.current && Keyboard.isVisible()) scrollRef.current?.scrollToEnd();
  }

  return {
    scrollRef,
    onScrollLayout: scrollIfFocused,
    lastField: {
      onFocus: () => {
        focused.current = true;
        scrollIfFocused();
      },
      onBlur: () => {
        focused.current = false;
      },
    },
  };
}
