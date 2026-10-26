import type { PetType } from '@/api/types';

export type Stage = 'pet' | 'budget' | 'ready';

export function resolveStage(petType: PetType | null, budgetAmount: number | null): Stage {
  if (petType === null) return 'pet';
  if (budgetAmount === null) return 'budget';
  return 'ready';
}
