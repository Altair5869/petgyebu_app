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

// The Android dialog shows and returns the device's local calendar day, so it gets local noon of
// the Seoul day instead of Seoul noon (which is the previous local day west of UTC-3).
function dayToLocalDate(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
}

function localDateToDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function ExpenseDateField({ day, minDay, maxDay, onChange, os = Platform.OS }: Props) {
  const [open, setOpen] = useState(false);
  if (os !== 'android') {
    return (
      <DatePicker
        value={seoulDayToDate(day)}
        mode="date"
        minimumDate={seoulDayToDate(minDay)}
        maximumDate={seoulDayToDate(maxDay)}
        timeZoneName="Asia/Seoul"
        locale="ko_KR"
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
          value={dayToLocalDate(day)}
          mode="date"
          minimumDate={dayToLocalDate(minDay)}
          maximumDate={dayToLocalDate(maxDay)}
          presentation="dialog"
          onValueChange={(_, selected) => {
            setOpen(false);
            onChange(localDateToDay(selected));
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
