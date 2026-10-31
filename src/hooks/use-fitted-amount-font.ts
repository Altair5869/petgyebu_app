import { useState } from 'react';
import { type LayoutChangeEvent, useWindowDimensions } from 'react-native';

import { fittedAmountFontSize } from '@/lib/amount-font';

// Scales a large amount field with the system text size, but never past the field's width.
// The returned size already includes the text scale, so the field must not scale it again.
export function useFittedAmountFont(text: string, baseSize: number) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  return {
    onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width),
    fontSize: fittedAmountFontSize(text, width, baseSize * fontScale),
  };
}
