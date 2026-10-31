import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ExpenseCategory } from '@/api/types';
import { ExpenseDateField } from '@/components/expense-date-field';
import { CATEGORIES, CATEGORY_LABELS, parseMemo } from '@/lib/expense';
import { formatAmountInput, parseAmountInput } from '@/lib/money';
import { todayInSeoul } from '@/lib/month';
import { colors, fonts } from '@/theme';

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
  // Receives an update of the latest draft, so an event from an older render keeps the other fields.
  onChange: (update: (draft: ExpenseDraft) => ExpenseDraft, field: ExpenseField) => void;
  fieldErrors: FieldErrors;
  minDay: string;
  allowCategoryClear: boolean;
  memoFocus?: { onFocus: () => void; onBlur: () => void };
};

export function ExpenseForm({ value, onChange, fieldErrors, minDay, allowCategoryClear, memoFocus }: Props) {
  const { amountText, day, category, memoText } = value;
  const amount = parseAmountInput(amountText, '금액을 입력해 주세요');
  const memo = parseMemo(memoText);

  return (
    <>
      <View style={styles.amountCard}>
        <Text style={styles.label}>금액</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="지출 금액"
            keyboardType="number-pad"
            value={amountText}
            onChangeText={(t) => onChange((d) => ({ ...d, amountText: formatAmountInput(t) }), 'amount')}
            placeholder="0"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
            style={styles.amountInput}
          />
          <Text style={styles.unit}>원</Text>
        </View>
        {!amount.ok && <Text style={styles.hint}>{amount.error}</Text>}
        {fieldErrors.amount && <Text style={styles.error}>{fieldErrors.amount}</Text>}
      </View>

      <View style={styles.field}>
        {/* The Android date button already reads 날짜; iOS keeps the caption beside its picker. */}
        <Text importantForAccessibility="no" style={styles.label}>날짜</Text>
        <ExpenseDateField
          day={day}
          minDay={minDay}
          maxDay={todayInSeoul()}
          onChange={(selected) => onChange((d) => ({ ...d, day: selected }), 'expenseDate')}
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
              onPress={() => {
                // The number pad has no close key; picking a category ends the amount entry.
                Keyboard.dismiss();
                onChange((d) => ({ ...d, category: d.category === c && allowCategoryClear ? null : c }), 'category');
              }}
              style={({ pressed }) => [styles.chip, category === c && styles.chipSelected, pressed && styles.pressed]}>
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
          onChangeText={(t) => onChange((d) => ({ ...d, memoText: t }), 'memo')}
          onFocus={memoFocus?.onFocus}
          onBlur={memoFocus?.onBlur}
          placeholder="선택"
          placeholderTextColor={colors.muted}
          selectionColor={colors.primary}
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
  amountCard: { gap: 12, padding: 24, borderRadius: 24, backgroundColor: colors.surface },
  label: { fontSize: 14, fontFamily: fonts.bold, color: colors.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderColor: colors.primary,
  },
  amountInput: { flex: 1, minWidth: 0, minHeight: 56, fontSize: 32, fontFamily: fonts.bold, paddingVertical: 12, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.regular, fontSize: 20, color: colors.text, marginLeft: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
  chipLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  chipLabelSelected: { color: colors.primary, fontFamily: fonts.bold },
  pressed: { opacity: 0.8 },
  memoInput: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fonts.regular,
    fontSize: 16,
    padding: 16,
    color: colors.text,
  },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
});
