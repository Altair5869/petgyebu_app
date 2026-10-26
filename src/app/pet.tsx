import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PetType } from '@/api/types';
import { Button } from '@/components/button';
import { errorMessage } from '@/lib/error-message';
import { PET_LABELS } from '@/lib/pet';
import { useSession } from '@/session/session-provider';
import { colors, fonts } from '@/theme';

const PET_TYPES: PetType[] = ['CAT', 'DOG'];

export default function PetScreen() {
  const { api, refreshStage } = useSession();
  const [selected, setSelected] = useState<PetType | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await api.putPet(selected);
      await refreshStage();
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>함께할 펫을 골라 주세요</Text>
      <View style={styles.cards}>
        {PET_TYPES.map((type) => (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ selected: selected === type }}
            onPress={() => setSelected(type)}
            style={({ pressed }) => [styles.card, selected === type && styles.cardSelected, pressed && styles.pressed]}>
            <Text style={styles.cardLabel}>{PET_LABELS[type]}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.footer}>
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="다음" onPress={save} disabled={!selected} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24, backgroundColor: colors.background },
  title: { fontSize: 24, fontFamily: fonts.bold, color: colors.text, marginTop: 24 },
  cards: { flexDirection: 'row', gap: 12 },
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.secondary },
  cardLabel: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  pressed: { opacity: 0.8 },
  footer: { marginTop: 'auto', gap: 12 },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger, textAlign: 'center' },
});
