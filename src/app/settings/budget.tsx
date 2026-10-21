import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { BudgetForm } from '@/components/budget-form';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { formatAmountInput, parseBudgetInput } from '@/lib/money';
import { currentMonth, monthTitle } from '@/lib/month';
import { useSession } from '@/session/session-provider';

export default function SettingsBudgetScreen() {
  const { api, refreshStage } = useSession();
  const month = currentMonth();
  const [text, setText] = useState('');
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Reloads when the month rolls over or on retry; a response for an earlier load is ignored.
  useEffect(() => {
    let active = true;
    api.getBudget(month).then(
      (budget) => {
        if (!active) return;
        setText(budget.amount === null ? '' : formatAmountInput(String(budget.amount)));
        setLoadState('ready');
      },
      () => {
        if (active) setLoadState('error');
      },
    );
    return () => {
      active = false;
    };
  }, [api, month, loadAttempt]);

  function retry() {
    setLoadState('loading');
    setLoadAttempt((n) => n + 1);
  }

  const parsed = parseBudgetInput(text);

  function handleChange(value: string) {
    setText(formatAmountInput(value));
    setServerError(null);
  }

  async function save() {
    if (!parsed.ok || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      await api.putBudget(month, parsed.amount);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.fieldMessage('month')) {
        // The month changed while this screen was open; re-check the stage for the new month.
        await refreshStage().catch((refreshError: unknown) => setServerError(errorMessage(refreshError)));
      } else {
        setServerError((e instanceof ApiError && e.fieldMessage('amount')) || errorMessage(e));
      }
      setSaving(false);
    }
  }

  if (loadState === 'loading') return <LoadingView />;
  if (loadState === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{monthTitle(month)} 예산</Text>
          <BudgetForm
            text={text}
            onChangeText={handleChange}
            serverError={serverError}
            saving={saving}
            onSave={() => void save()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  keyboardAvoiding: { flex: 1 },
  container: { padding: 24, gap: 24 },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
});
