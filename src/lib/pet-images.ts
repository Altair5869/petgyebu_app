import type { ImageSource } from 'expo-image';

import type { PetState, PetType } from '@/api/types';

export type PetImages = Partial<Record<PetType, Partial<Record<PetState, ImageSource | number>>>>;

// One image per pet and state; Metro picks the @2x/@3x file for the screen. A missing entry shows
// the placeholder box. Originals and how these were exported: README "펫 그림 넣기".
export const PET_IMAGES: PetImages = {
  CAT: {
    STABLE: require('../../assets/images/pets/cat-stable.png'),
    CAUTION: require('../../assets/images/pets/cat-caution.png'),
    WARNING: require('../../assets/images/pets/cat-warning.png'),
    BUDGET_REACHED: require('../../assets/images/pets/cat-budget-reached.png'),
  },
  DOG: {
    STABLE: require('../../assets/images/pets/dog-stable.png'),
    CAUTION: require('../../assets/images/pets/dog-caution.png'),
    WARNING: require('../../assets/images/pets/dog-warning.png'),
    BUDGET_REACHED: require('../../assets/images/pets/dog-budget-reached.png'),
  },
};
