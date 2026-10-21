import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { Button } from '@/components/button';
import {
  EXPENSE_FIELDS,
  ExpenseForm,
  type ExpenseDraft,
  type ExpenseField,
  type FieldErrors,
} from '@/components/expense-form';
import { SAVE_UNCONFIRMED, errorMessage } from '@/lib/error-message';
import { parseMemo } from '@/lib/expense';
import { parseAmountInput } from '@/lib/money';
import { todayInSeoul } from '@/lib/month';
import { useSession } from '@/session/session-provider';

export default function NewExpenseScreen() {
  const { api } = useSession();
  const [draft, setDraft] = useState<ExpenseDraft>(() => ({
    amountText: '',
    day: todayInSeoul(),
    category: null,
    memoText: '',
  }));
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // The last attempted input and its key: a retry of the same input reuses the key so the server records it once.
  const attempt = useRef<{ input: string; key: string } | null>(null);

  function clearError(field?: ExpenseField) {
    setFormError(null);
    if (field) setFieldErrors(({ [field]: _cleared, ...rest }) => rest);
  }

  const amount = parseAmountInput(draft.amountText, '금액을 입력해 주세요');
  const memo = parseMemo(draft.memoText);

  async function save() {
    if (!amount.ok || !memo.ok || saving) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const body = {
        amount: amount.amount,
        expenseDate: draft.day,
        category: draft.category ?? 'OTHER',
        memo: memo.memo,
      };
      const input = JSON.stringify(body);
      if (attempt.current?.input !== input) attempt.current = { input, key: randomUUID() };
      await api.createExpense(body, attempt.current.key);
      router.back();
    } catch (e) {
      const fields = e instanceof ApiError ? e.fields : [];
      const known = fields.filter((f) => (EXPENSE_FIELDS as string[]).includes(f.field));
      if (known.length > 0) setFieldErrors(Object.fromEntries(known.map((f) => [f.field, f.message])));
      else setFormError(errorMessage(e, SAVE_UNCONFIRMED));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled">
          <ExpenseForm
            value={draft}
            onChange={(next, field) => {
              clearError(field);
              setDraft(next);
            }}
            fieldErrors={fieldErrors}
            minDay="2000-01-01"
            allowCategoryClear
          />
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
  error: { color: '#D93025' },
  footer: { paddingHorizontal: 24, paddingBottom: 16, gap: 8 },
});
