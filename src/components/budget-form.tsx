import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { parseBudgetInput } from '@/lib/money';

type BudgetFormProps = {
  text: string;
  onChangeText: (text: string) => void;
  hint?: string | null;
  serverError?: string | null;
  saving: boolean;
  onSave: () => void;
};

export function BudgetForm({ text, onChangeText, hint, serverError, saving, onSave }: BudgetFormProps) {
  const parsed = parseBudgetInput(text);

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="예산 금액"
            keyboardType="number-pad"
            value={text}
            onChangeText={onChangeText}
            placeholder="0"
            style={styles.input}
          />
          <Text style={styles.unit}>원</Text>
        </View>
        {hint && <Text style={styles.hint}>{hint}</Text>}
        {!parsed.ok && <Text style={styles.hint}>{parsed.error}</Text>}
        {serverError && <Text style={styles.error}>{serverError}</Text>}
      </View>
      <View style={styles.footer}>
        <Button label="저장" onPress={onSave} disabled={!parsed.ok} loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 24 },
  field: { gap: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: '#208AEF' },
  input: { flex: 1, fontSize: 28, paddingVertical: 8, color: '#111' },
  unit: { fontSize: 24, color: '#111' },
  hint: { color: '#555' },
  error: { color: '#D93025' },
  footer: { marginTop: 'auto' },
});
