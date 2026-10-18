import DatePicker from '@expo/ui/community/datetime-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { ExpenseCategory } from '@/api/types';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { CATEGORIES, CATEGORY_LABELS, parseMemo } from '@/lib/expense';
import { formatAmountInput, parseAmountInput } from '@/lib/money';
import { dateToSeoulDay, seoulDayToDate, todayInSeoul } from '@/lib/month';
import { useSession } from '@/session/session-provider';

const MIN_DATE = seoulDayToDate('2000-01-01');

type FieldErrors = Partial<Record<'amount' | 'expenseDate' | 'category' | 'memo', string>>;

export default function NewExpenseScreen() {
  const { api } = useSession();
  const [amountText, setAmountText] = useState('');
  const [day, setDay] = useState(() => todayInSeoul());
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [memoText, setMemoText] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const amount = parseAmountInput(amountText, '금액을 입력해 주세요');
  const memo = parseMemo(memoText);

  async function save() {
    if (!amount.ok || !memo.ok || saving) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await api.createExpense({ amount: amount.amount, expenseDate: day, category: category ?? 'OTHER', memo: memo.memo });
      router.back();
    } catch (e) {
      const fields = e instanceof ApiError ? e.fields : [];
      if (fields.length > 0) setFieldErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
      else setFormError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.label}>금액</Text>
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="지출 금액"
                keyboardType="number-pad"
                value={amountText}
                onChangeText={(t) => setAmountText(formatAmountInput(t))}
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
              minimumDate={MIN_DATE}
              maximumDate={seoulDayToDate(todayInSeoul())}
              timeZoneName="Asia/Seoul"
              locale="ko_KR"
              onValueChange={(_, selected) => setDay(dateToSeoulDay(selected))}
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
                  onPress={() => setCategory((current) => (current === c ? null : c))}
                  style={[styles.chip, category === c && styles.chipSelected]}>
                  <Text style={[styles.chipLabel, category === c && styles.chipLabelSelected]}>{CATEGORY_LABELS[c]}</Text>
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
              onChangeText={setMemoText}
              placeholder="선택"
              style={styles.memoInput}
            />
            {!memo.ok && <Text style={styles.error}>{memo.error}</Text>}
            {fieldErrors.memo && <Text style={styles.error}>{fieldErrors.memo}</Text>}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {formError && <Text style={styles.error}>{formError}</Text>}
          <Button label="저장" onPress={() => void save()} disabled={!amount.ok || !memo.ok} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  form: { padding: 24, gap: 24 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#555' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: '#208AEF' },
  amountInput: { flex: 1, fontSize: 28, paddingVertical: 8, color: '#111' },
  unit: { fontSize: 24, color: '#111' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { borderColor: '#208AEF', backgroundColor: '#EAF4FE' },
  chipLabel: { fontSize: 15, color: '#333' },
  chipLabelSelected: { color: '#1565C0', fontWeight: '600' },
  memoInput: { borderBottomWidth: 1, borderColor: '#D1D5DB', fontSize: 16, paddingVertical: 8, color: '#111' },
  hint: { color: '#555' },
  error: { color: '#D93025' },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
});
