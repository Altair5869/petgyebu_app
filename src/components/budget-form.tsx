import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { parseBudgetInput } from '@/lib/money';
import { colors, fonts } from '@/theme';

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
        {/* The input carries the same label, so screen readers (and taps by name) reach the input only. */}
        <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.label}>예산 금액</Text>
        <View style={styles.inputRow}>
          <TextInput
            accessibilityLabel="예산 금액"
            keyboardType="number-pad"
            value={text}
            onChangeText={onChangeText}
            placeholder="0"
            placeholderTextColor={colors.muted}
            selectionColor={colors.primary}
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
  field: { gap: 12, backgroundColor: colors.surface, padding: 24, borderRadius: 24 },
  label: { fontSize: 14, fontFamily: fonts.bold, color: colors.muted },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: colors.primary },
  input: { flex: 1, minWidth: 0, minHeight: 56, fontSize: 32, fontFamily: fonts.bold, paddingVertical: 12, color: colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.regular, fontSize: 20, color: colors.text, marginLeft: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.muted },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
  footer: { marginTop: 'auto' },
});
