import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useLastFieldScroll } from '@/hooks/use-last-field-scroll';
import { SAVE_UNCONFIRMED, errorMessage } from '@/lib/error-message';
import { parseMemo } from '@/lib/expense';
import { parseAmountInput } from '@/lib/money';
import { todayInSeoul } from '@/lib/month';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

export default function NewExpenseScreen() {
  const { api } = useSession();
  // The keyboard avoider measures itself from below the native header, so add the header back.
  const headerHeight = useHeaderHeight();
  const { scrollRef, onScrollLayout, onContentSizeChange, lastField } = useLastFieldScroll();
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
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={headerHeight}
        style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          onLayout={onScrollLayout}
          onContentSizeChange={onContentSizeChange}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.form}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled">
          <ExpenseForm
            value={draft}
            onChange={(update, field) => {
              clearError(field);
              setDraft(update);
            }}
            fieldErrors={fieldErrors}
            minDay="2000-01-01"
            allowCategoryClear
            memoFocus={lastField}
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
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  form: { ...contentWidth, padding: 24, gap: 24 },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
  footer: { ...contentWidth, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 8 },
});
