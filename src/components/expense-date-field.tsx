import DatePicker from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { dateToSeoulDay, seoulDayToDate } from '@/lib/month';
import { colors, fonts } from '@/theme';

type Props = {
  day: string;
  minDay: string;
  maxDay: string;
  onChange: (day: string) => void;
  os?: string;
};

function fullDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${year}년 ${month}월 ${date}일`;
}

export function ExpenseDateField({ day, minDay, maxDay, onChange, os = Platform.OS }: Props) {
  const [open, setOpen] = useState(false);
  const pickerProps = {
    value: seoulDayToDate(day),
    mode: 'date',
    minimumDate: seoulDayToDate(minDay),
    maximumDate: seoulDayToDate(maxDay),
    timeZoneName: 'Asia/Seoul',
    locale: 'ko_KR',
  } as const;

  if (os !== 'android') {
    return (
      <DatePicker
        {...pickerProps}
        testID="expense-date"
        display="compact"
        onValueChange={(_, selected) => onChange(dateToSeoulDay(selected))}
      />
    );
  }

  // On Android the picker is a dialog that opens as soon as it mounts, so mount it only on demand.
  const label = fullDayLabel(day);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`날짜, ${label}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && styles.pressed]}>
        <Text style={styles.text}>{label}</Text>
      </Pressable>
      {open && (
        <DatePicker
          {...pickerProps}
          presentation="dialog"
          onValueChange={(_, selected) => {
            setOpen(false);
            onChange(dateToSeoulDay(selected));
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 16,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  text: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  pressed: { opacity: 0.8 },
});
