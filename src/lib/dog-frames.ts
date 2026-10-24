import type { PetState } from '@/api/types';
import type { PetPose } from '@/lib/pet-interaction';

// Exact 744×576 Canvas exports from the standalone preview.
export const DOG_FRAMES: Record<PetState, Record<PetPose, number>> = {
  STABLE: {
    open: require('../../assets/images/pets/dog-interaction/dog-stable-open.png'),
    half: require('../../assets/images/pets/dog-interaction/dog-stable-half.png'),
    closed: require('../../assets/images/pets/dog-interaction/dog-stable-closed.png'),
  },
  CAUTION: {
    open: require('../../assets/images/pets/dog-interaction/dog-caution-open.png'),
    half: require('../../assets/images/pets/dog-interaction/dog-caution-half.png'),
    closed: require('../../assets/images/pets/dog-interaction/dog-caution-closed.png'),
  },
  WARNING: {
    open: require('../../assets/images/pets/dog-interaction/dog-warning-open.png'),
    half: require('../../assets/images/pets/dog-interaction/dog-warning-half.png'),
    closed: require('../../assets/images/pets/dog-interaction/dog-warning-closed.png'),
  },
  BUDGET_REACHED: {
    open: require('../../assets/images/pets/dog-interaction/dog-budget-reached-open.png'),
    half: require('../../assets/images/pets/dog-interaction/dog-budget-reached-half.png'),
    closed: require('../../assets/images/pets/dog-interaction/dog-budget-reached-closed.png'),
  },
};
