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

export type ExpenseCategory = 'FOOD' | 'CAFE' | 'TRANSPORT' | 'SHOPPING' | 'HEALTH' | 'LIVING' | 'OTHER';

export type Expense = {
  id: number;
  amount: number;
  expenseDate: string;
  category: ExpenseCategory;
  memo: string | null;
};

export type NewExpense = Omit<Expense, 'id'>;

// PATCH body: only the changed fields.
export type ExpenseUpdate = Partial<NewExpense>;

export type ExpensePage = { items: Expense[]; nextCursor: string | null };
