import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { PetState, PetType } from '@/api/types';
import { PET_IMAGES, type PetImages } from '@/lib/pet-images';
import { PET_LABELS, PET_STATE_COPY } from '@/lib/pet';

// Soft tints only: no red, nothing that reads as blame (docs/01 §5).
const PLACEHOLDER_TINTS: Record<PetState, string> = {
  STABLE: '#E6F4EA',
  CAUTION: '#FFF4D6',
  WARNING: '#FFE5CC',
  BUDGET_REACHED: '#EDE7F6',
};

type PetImageProps = { petType: PetType; petState: PetState; images?: PetImages };

export function PetImage({ petType, petState, images = PET_IMAGES }: PetImageProps) {
  const copy = PET_STATE_COPY[petState];
  const label = `${PET_LABELS[petType]}, ${copy.name}: ${copy.description}`;
  const source = images[petType]?.[petState];

  if (source !== undefined) {
    return <Image accessible accessibilityRole="image" accessibilityLabel={label} source={source} contentFit="contain" style={styles.frame} />;
  }
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, styles.placeholder, { backgroundColor: PLACEHOLDER_TINTS[petState] }]}>
      <Text style={styles.type}>{petType}</Text>
      <Text style={styles.state}>{petState}</Text>
      <Text style={styles.note}>임시 그림</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 120, height: 120, borderRadius: 16, alignSelf: 'center' },
  placeholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9AA4B2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  type: { fontSize: 14, fontWeight: '700', color: '#333' },
  state: { fontSize: 12, color: '#333' },
  note: { fontSize: 11, color: '#666' },
});
