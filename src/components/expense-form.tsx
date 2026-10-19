import DatePicker from '@expo/ui/community/datetime-picker';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ExpenseCategory } from '@/api/types';
import { CATEGORIES, CATEGORY_LABELS, parseMemo } from '@/lib/expense';
import { formatAmountInput, parseAmountInput } from '@/lib/money';
import { dateToSeoulDay, seoulDayToDate, todayInSeoul } from '@/lib/month';

export type ExpenseDraft = {
  amountText: string;
  day: string;
  category: ExpenseCategory | null;
  memoText: string;
};

export type ExpenseField = 'amount' | 'expenseDate' | 'category' | 'memo';

export type FieldErrors = Partial<Record<ExpenseField, string>>;

export const EXPENSE_FIELDS: ExpenseField[] = ['amount', 'expenseDate', 'category', 'memo'];

type Props = {
  value: ExpenseDraft;
  onChange: (next: ExpenseDraft, field: ExpenseField) => void;
  fieldErrors: FieldErrors;
  minDay: string;
  allowCategoryClear: boolean;
};

export function ExpenseForm({ value, onChange, fieldErrors, minDay, allowCategoryClear }: Props) {
  const { amountText, day, category, memoText } = value;
  const amount = parseAmountInput(amountText, '금액을 입력해 주세요');
  const memo = parseMemo(memoText);

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>금액</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="지출 금액"
            keyboardType="number-pad"
            value={amountText}
            onChangeText={(t) => onChange({ ...value, amountText: formatAmountInput(t) }, 'amount')}
            placeholder="0"
            style={styles.amountInput}
          />
          <Text style={styles.unit}>원</Text>
        </View>
        {!amount.ok && <Text style={styles.hint}>{amount.error}</Text>}
        {fieldErrors.amount && <Text style={styles.error}>{fieldErrors.amount}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>날짜</Text>
        <DatePicker
          testID="expense-date"
          value={seoulDayToDate(day)}
          mode="date"
          display="compact"
          minimumDate={seoulDayToDate(minDay)}
          maximumDate={seoulDayToDate(todayInSeoul())}
          timeZoneName="Asia/Seoul"
          locale="ko_KR"
          onValueChange={(_, selected) => onChange({ ...value, day: dateToSeoulDay(selected) }, 'expenseDate')}
        />
        {fieldErrors.expenseDate && <Text style={styles.error}>{fieldErrors.expenseDate}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>카테고리</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={CATEGORY_LABELS[c]}
              accessibilityState={{ selected: category === c }}
              onPress={() =>
                onChange({ ...value, category: category === c && allowCategoryClear ? null : c }, 'category')
              }
              style={[styles.chip, category === c && styles.chipSelected]}>
              <Text style={[styles.chipLabel, category === c && styles.chipLabelSelected]}>
                {CATEGORY_LABELS[c]}
              </Text>
            </Pressable>
          ))}
        </View>
        {fieldErrors.category && <Text style={styles.error}>{fieldErrors.category}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>메모</Text>
        <TextInput
          accessibilityLabel="메모"
          value={memoText}
          onChangeText={(t) => onChange({ ...value, memoText: t }, 'memo')}
          placeholder="선택"
          style={styles.memoInput}
        />
        {!memo.ok && <Text style={styles.error}>{memo.error}</Text>}
        {fieldErrors.memo && <Text style={styles.error}>{fieldErrors.memo}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: '#208AEF',
  },
  amountInput: { flex: 1, fontSize: 28, paddingVertical: 8, color: '#111' },
  unit: { fontSize: 24, color: '#111' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { borderColor: '#208AEF', backgroundColor: '#EAF4FE' },
  chipLabel: { fontSize: 15, color: '#333' },
  chipLabelSelected: { color: '#1565C0', fontWeight: '600' },
  memoInput: {
    borderBottomWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 16,
    paddingVertical: 8,
    color: '#111',
  },
  hint: { color: '#555' },
  error: { color: '#D93025' },
});
