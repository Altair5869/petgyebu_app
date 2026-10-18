import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { formatBudgetInput, parseBudgetInput } from '@/lib/money';
import { currentMonth, monthTitle, previousMonth } from '@/lib/month';
import { useSession } from '@/session/session-provider';

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
        setText(formatBudgetInput(String(budget.amount)));
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
    setText(formatBudgetInput(value));
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
        await refreshStage().catch(() => {});
      } else {
        setServerError((e instanceof ApiError && e.fieldMessage('amount')) || errorMessage(e));
      }
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>{monthTitle(month)} 예산</Text>
      <View style={styles.field}>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="예산 금액"
            keyboardType="number-pad"
            value={text}
            onChangeText={handleChange}
            placeholder="0"
            style={styles.input}
          />
          <Text style={styles.unit}>원</Text>
        </View>
        {suggested && <Text style={styles.hint}>지난달 예산을 불러왔어요</Text>}
        {!parsed.ok && <Text style={styles.hint}>{parsed.error}</Text>}
        {serverError && <Text style={styles.error}>{serverError}</Text>}
      </View>
      <View style={styles.footer}>
        <Button label="저장" onPress={() => void save()} disabled={!parsed.ok} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#111', marginTop: 24 },
  field: { gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: '#208AEF' },
  input: { flex: 1, fontSize: 28, paddingVertical: 8, color: '#111' },
  unit: { fontSize: 24, color: '#111' },
  hint: { color: '#555' },
  error: { color: '#D93025' },
  footer: { marginTop: 'auto' },
});
