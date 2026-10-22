import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { BudgetForm } from '@/components/budget-form';
import { errorMessage } from '@/lib/error-message';
import { formatAmountInput, parseBudgetInput } from '@/lib/money';
import { currentMonth, monthTitle, previousMonth } from '@/lib/month';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

export default function BudgetScreen() {
  const { api, refreshStage } = useSession();
  const month = currentMonth();
  const [text, setText] = useState('');
  const [suggested, setSuggested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const touched = useRef(false);

  // Suggest last month's budget; never save it until the user does.
  useEffect(() => {
    let active = true;
    api.getBudget(previousMonth(month)).then(
      (budget) => {
        if (!active || touched.current || budget.amount === null) return;
        setText(formatAmountInput(String(budget.amount)));
        setSuggested(true);
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [api, month]);

  const parsed = parseBudgetInput(text);

  function handleChange(value: string) {
    touched.current = true;
    setText(formatAmountInput(value));
    setSuggested(false);
    setServerError(null);
  }

  async function save() {
    if (!parsed.ok || saving) return;
    setSaving(true);
    setServerError(null);
    try {
      await api.putBudget(month, parsed.amount);
      await refreshStage();
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoiding}>
        <View style={styles.container}>
          <Text style={styles.title}>{monthTitle(month)} 예산</Text>
          <BudgetForm
            text={text}
            onChangeText={handleChange}
            hint={suggested ? '지난달 예산을 불러왔어요' : null}
            serverError={serverError}
            saving={saving}
            onSave={() => void save()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoiding: { flex: 1 },
  container: { ...contentWidth, flex: 1, padding: 24, gap: 24 },
  title: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, marginTop: 24 },
});
