import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExpenseDateField } from '@/components/expense-date-field';

// The native picker is replaced by a stub that exposes its select and dismiss callbacks.
jest.mock('@expo/ui/community/datetime-picker', () => {
  const { createElement } = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: {
      testID?: string;
      presentation?: string;
      onValueChange: (e: unknown, d: Date) => void;
      onDismiss?: () => void;
    }) =>
      createElement(View, { testID: 'picker', accessibilityHint: props.presentation ?? 'none' }, [
        createElement(Text, {
          key: 'select',
          onPress: () =>
            props.onValueChange(
              { nativeEvent: { timestamp: 0, utcOffset: 0 } },
              jest.requireActual('@/lib/month').seoulDayToDate('2026-10-03'),
            ),
        }, 'select'),
        createElement(Text, { key: 'dismiss', onPress: () => props.onDismiss?.() }, 'dismiss'),
      ]),
  };
});

const baseProps = { day: '2026-10-25', minDay: '2026-01-01', maxDay: '2026-10-25' };

describe('on Android', () => {
  test('shows the date as a button and keeps the dialog closed until pressed', async () => {
    await render(<ExpenseDateField {...baseProps} onChange={jest.fn()} os="android" />);
    expect(screen.getByRole('button', { name: '날짜, 2026년 10월 25일' })).toBeTruthy();
    expect(screen.queryByTestId('picker')).toBeNull();
  });

  test('opens the dialog on press, reports the picked day and closes', async () => {
    const onChange = jest.fn();
    await render(<ExpenseDateField {...baseProps} onChange={onChange} os="android" />);
    await fireEvent.press(screen.getByRole('button', { name: '날짜, 2026년 10월 25일' }));
    expect(screen.getByTestId('picker').props.accessibilityHint).toBe('dialog');

    await fireEvent.press(screen.getByText('select'));
    expect(onChange).toHaveBeenCalledWith('2026-10-03');
    expect(screen.queryByTestId('picker')).toBeNull();
  });

  test('closes the dialog on cancel without changing the day', async () => {
    const onChange = jest.fn();
    await render(<ExpenseDateField {...baseProps} onChange={onChange} os="android" />);
    await fireEvent.press(screen.getByRole('button', { name: '날짜, 2026년 10월 25일' }));
    await fireEvent.press(screen.getByText('dismiss'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId('picker')).toBeNull();
  });
});

test('renders the inline picker directly on iOS', async () => {
  const onChange = jest.fn();
  await render(<ExpenseDateField {...baseProps} onChange={onChange} os="ios" />);
  expect(screen.queryByRole('button')).toBeNull();
  await fireEvent.press(screen.getByText('select'));
  expect(onChange).toHaveBeenCalledWith('2026-10-03');
});
