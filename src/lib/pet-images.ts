import type { ImageSource } from 'expo-image';

import type { PetState, PetType } from '@/api/types';

export type PetImages = Partial<Record<PetType, Partial<Record<PetState, ImageSource | number>>>>;

// Real artwork goes here, one entry per image, e.g.
//   CAT: { STABLE: require('../../assets/images/pets/cat-stable.png') },
// Any pet/state without an entry shows the placeholder box.
export const PET_IMAGES: PetImages = {};
