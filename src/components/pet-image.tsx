import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { PetState, PetType } from '@/api/types';
import { PET_IMAGES, type PetImages } from '@/lib/pet-images';

// The home card's text right below already says the pet and its state, so the picture is hidden
// from screen readers instead of being read as a second copy of it.
const HIDDEN_FROM_SCREEN_READER = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

// Soft tints only: no red, nothing that reads as blame (docs/01 §5).
const PLACEHOLDER_TINTS: Record<PetState, string> = {
  STABLE: '#E6F4EA',
  CAUTION: '#FFF4D6',
  WARNING: '#FFE5CC',
  BUDGET_REACHED: '#EDE7F6',
};

type PetImageProps = { petType: PetType; petState: PetState; images?: PetImages };

export function PetImage({ petType, petState, images = PET_IMAGES }: PetImageProps) {
  const source = images[petType]?.[petState];

  if (source !== undefined) {
    return <Image {...HIDDEN_FROM_SCREEN_READER} testID="pet-image" source={source} contentFit="contain" style={styles.art} />;
  }
  return (
    <View
      {...HIDDEN_FROM_SCREEN_READER}
      testID="pet-image"
      style={[styles.frame, styles.placeholder, { backgroundColor: PLACEHOLDER_TINTS[petState] }]}>
      <Text style={styles.type}>{petType}</Text>
      <Text style={styles.state}>{petState}</Text>
      <Text style={styles.note}>임시 그림</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Artwork is exported bottom-aligned at this size so the paws rest on the budget gauge below.
  art: { width: 124, height: 96, alignSelf: 'center' },
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
