import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { NewExpense } from '@/api/types';
import { Button } from '@/components/button';
import {
  EXPENSE_FIELDS,
  ExpenseForm,
  type ExpenseDraft,
  type ExpenseField,
  type FieldErrors,
} from '@/components/expense-form';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { expenseChanges, parseMemo } from '@/lib/expense';
import { formatAmountInput, parseAmountInput } from '@/lib/money';
import { currentMonth, firstDayOfMonthInSeoul } from '@/lib/month';
import { useSession } from '@/session/session-provider';

type Screen =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'pastMonth' }
  | { status: 'ready'; original: NewExpense };

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

export default function EditExpenseScreen() {
  const { api } = useSession();
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const [screen, setScreen] = useState<Screen>({ status: 'loading' });
  const [draft, setDraft] = useState<ExpenseDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    return api.getExpense(id).then(
      (expense) => {
        if (expense.expenseDate.slice(0, 7) !== currentMonth()) {
          setScreen({ status: 'pastMonth' });
          return;
        }
        const { id: _id, ...original } = expense;
        setDraft({
          amountText: formatAmountInput(String(original.amount)),
          day: original.expenseDate,
          category: original.category,
          memoText: original.memo ?? '',
        });
        setScreen({ status: 'ready', original });
      },
      (e: unknown) => setScreen({ status: isNotFound(e) ? 'notFound' : 'error' }),
    );
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  function retry() {
    setScreen({ status: 'loading' });
    load();
  }

  if (screen.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;
  if (screen.status === 'notFound') {
    return <MessageView message="이미 삭제된 지출이에요" actionLabel="내역으로" onAction={() => router.back()} />;
  }
  if (screen.status === 'pastMonth') {
    return <MessageView message="지난달 지출은 아직 고칠 수 없어요" actionLabel="내역으로" onAction={() => router.back()} />;
  }
  if (screen.status !== 'ready' || !draft) return <LoadingView />;

  const { original } = screen;
  const amount = parseAmountInput(draft.amountText, '금액을 입력해 주세요');
  const memo = parseMemo(draft.memoText);
  const changes =
    amount.ok && memo.ok
      ? expenseChanges(original, {
          amount: amount.amount,
          expenseDate: draft.day,
          category: draft.category ?? original.category,
          memo: memo.memo,
        })
      : null;
  const canSave = changes !== null && Object.keys(changes).length > 0;

  function clearError(field?: ExpenseField) {
    setFormError(null);
    if (field) setFieldErrors(({ [field]: _cleared, ...rest }) => rest);
  }

  async function save() {
    if (!changes || !canSave || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      await api.updateExpense(id, changes);
      router.back();
    } catch (e) {
      if (isNotFound(e)) {
        setScreen({ status: 'notFound' });
        return;
      }
      const fields = e instanceof ApiError ? e.fields : [];
      const known = fields.filter((f) => (EXPENSE_FIELDS as string[]).includes(f.field));
      if (known.length > 0) setFieldErrors(Object.fromEntries(known.map((f) => [f.field, f.message])));
      else setFormError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFormError(null);
    try {
      await api.deleteExpense(id);
      router.back();
    } catch (e) {
      if (isNotFound(e)) {
        router.back();
        return;
      }
      setFormError(errorMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('이 지출을 삭제할까요?', undefined, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void remove() },
    ]);
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
            minDay={firstDayOfMonthInSeoul()}
            allowCategoryClear={false}
          />
        </ScrollView>
        <View style={styles.footer}>
          {formError && <Text style={styles.error}>{formError}</Text>}
          <Button label="저장" onPress={() => void save()} disabled={!canSave || busy} loading={busy} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="삭제"
            disabled={busy}
            onPress={confirmDelete}
            style={[styles.delete, busy && styles.inactive]}>
            <Text style={styles.deleteLabel}>삭제</Text>
          </Pressable>
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
  delete: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  inactive: { opacity: 0.4 },
  deleteLabel: { color: '#D93025', fontSize: 16, fontWeight: '600' },
});
