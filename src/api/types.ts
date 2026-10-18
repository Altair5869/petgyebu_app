// Response shapes from docs/api-spec.md.
export type Provider = 'kakao' | 'google';
export type PetType = 'CAT' | 'DOG';
export type PetState = 'STABLE' | 'CAUTION' | 'WARNING' | 'BUDGET_REACHED';

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessExpiresInSeconds: number;
};

export type Me = { id: number; provider: 'KAKAO' | 'GOOGLE'; petType: PetType | null };

export type Budget = { month: string; amount: number | null };

export type Home = {
  month: string;
  petType: PetType;
  petState: PetState;
  budgetAmount: number;
  spentAmount: number;
  usagePercent: number;
  budgetBalanceAmount: number;
};

export type FieldError = { field: string; message: string };

export type ErrorBody = { code: string; message: string; fields?: FieldError[] };
