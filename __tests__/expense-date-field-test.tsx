import { fireEvent, render, screen } from '@testing-library/react-native';

import { ExpenseDateField } from '@/components/expense-date-field';
import { seoulDayToDate } from '@/lib/month';

// The native picker is replaced by a stub that keeps its props and reports mockPicked on select.
let mockPicked = new Date(0);
let mockProps: { value?: Date; minimumDate?: Date; maximumDate?: Date } = {};

jest.mock('@expo/ui/community/datetime-picker', () => {
  const { createElement } = jest.requireActual('react');
  const { Text, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (props: {
      value: Date;
      minimumDate?: Date;
      maximumDate?: Date;
      presentation?: string;
      onValueChange: (e: unknown, d: Date) => void;
      onDismiss?: () => void;
    }) => {
      mockProps = props;
      return createElement(View, { testID: 'picker', accessibilityHint: props.presentation ?? 'none' }, [
        createElement(Text, {
          key: 'select',
          onPress: () => props.onValueChange({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, mockPicked),
        }, 'select'),
        createElement(Text, { key: 'dismiss', onPress: () => props.onDismiss?.() }, 'dismiss'),
      ]);
    },
  };
});

const baseProps = { day: '2026-10-25', minDay: '2026-01-01', maxDay: '2026-10-25' };

function localDay(date: Date | undefined): string {
  return date ? `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}` : '';
}

describe('on Android', () => {
  // The Android dialog reads and returns dates by the device's local calendar day.
  beforeEach(() => {
    mockPicked = new Date(2026, 9, 3, 12);
  });

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

  // Jest runs west of Seoul (jest.global-setup.js), where Seoul noon falls on the previous local day.
  test('opens the dialog on the same calendar day and bounds as the button', async () => {
    await render(<ExpenseDateField {...baseProps} onChange={jest.fn()} os="android" />);
    await fireEvent.press(screen.getByRole('button', { name: '날짜, 2026년 10월 25일' }));
    expect(localDay(mockProps.value)).toBe('2026-10-25');
    expect(localDay(mockProps.minimumDate)).toBe('2026-1-1');
    expect(localDay(mockProps.maximumDate)).toBe('2026-10-25');
  });
});

test('renders the inline picker directly on iOS', async () => {
  mockPicked = seoulDayToDate('2026-10-03');
  const onChange = jest.fn();
  await render(<ExpenseDateField {...baseProps} onChange={onChange} os="ios" />);
  expect(screen.queryByRole('button')).toBeNull();
  await fireEvent.press(screen.getByText('select'));
  expect(onChange).toHaveBeenCalledWith('2026-10-03');
});
