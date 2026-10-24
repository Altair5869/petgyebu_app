import type { PetState } from '@/api/types';
import type { PetPose } from '@/lib/pet-interaction';

// 465×360 area-resampled exports from the approved standalone preview.
export const CAT_FRAMES: Record<PetState, Record<PetPose, number>> = {
  STABLE: {
    open: require('../../assets/images/pets/cat-interaction/cat-stable-open.png'),
    half: require('../../assets/images/pets/cat-interaction/cat-stable-half.png'),
    closed: require('../../assets/images/pets/cat-interaction/cat-stable-closed.png'),
  },
  CAUTION: {
    open: require('../../assets/images/pets/cat-interaction/cat-caution-open.png'),
    half: require('../../assets/images/pets/cat-interaction/cat-caution-half.png'),
    closed: require('../../assets/images/pets/cat-interaction/cat-caution-closed.png'),
  },
  WARNING: {
    open: require('../../assets/images/pets/cat-interaction/cat-warning-open.png'),
    half: require('../../assets/images/pets/cat-interaction/cat-warning-half.png'),
    closed: require('../../assets/images/pets/cat-interaction/cat-warning-closed.png'),
  },
  BUDGET_REACHED: {
    open: require('../../assets/images/pets/cat-interaction/cat-budget-reached-open.png'),
    half: require('../../assets/images/pets/cat-interaction/cat-budget-reached-half.png'),
    closed: require('../../assets/images/pets/cat-interaction/cat-budget-reached-closed.png'),
  },
};
