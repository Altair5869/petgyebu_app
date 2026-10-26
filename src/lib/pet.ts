import type { PetState, PetType } from '@/api/types';

export const PET_LABELS: Record<PetType, string> = { CAT: '고양이', DOG: '강아지' };

// Avoid blame, illness, or punishment wording (docs/00 §4).
export const PET_STATE_COPY: Record<PetState, { name: string; description: string }> = {
  STABLE: { name: '안정', description: '예산에 여유가 있어 마음이 편안해요' },
  CAUTION: { name: '주의', description: '남은 예산을 함께 살펴볼까요?' },
  WARNING: { name: '경고', description: '예산이 얼마 남지 않아 조금 걱정돼요' },
  BUDGET_REACHED: { name: '예산 도달', description: '앗, 이번 달 예산을 모두 사용했어요' },
};

// Share of the budget still left, 0..1, for the gauge under the pet. Over budget reads as empty.
export function remainingBudgetRatio(budgetAmount: number, budgetBalanceAmount: number): number {
  if (budgetAmount <= 0) return 0;
  return Math.min(1, Math.max(0, budgetBalanceAmount / budgetAmount));
}
