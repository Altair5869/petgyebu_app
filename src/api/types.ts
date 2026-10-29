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

export type CategoryStat = {
  category: ExpenseCategory;
  spentAmount: number;
  expenseCount: number;
  sharePercent: number;
};

// Budget-dependent fields are null when the month has no budget.
export type MonthStats = {
  month: string;
  budgetAmount: number | null;
  spentAmount: number;
  expenseCount: number;
  usagePercent: number | null;
  budgetBalanceAmount: number | null;
  categories: CategoryStat[];
};

export type DayRange = { from: string; to: string };

export type WeeklyCategoryChange = {
  category: ExpenseCategory;
  thisWeekAmount: number;
  lastWeekAmount: number;
  changeAmount: number;
};

export type ForecastStatus = 'NO_BUDGET' | 'BUDGET_REACHED' | 'TOO_EARLY' | 'WILL_EXHAUST' | 'WITHIN_BUDGET';

// The keys are always present; the values are null when the status has no such figure.
export type Forecast = {
  status: ForecastStatus;
  dailyAverageAmount: number | null;
  exhaustionDate: string | null;
};

export type Insights = {
  today: string;
  weekly: { thisWeek: DayRange; lastWeek: DayRange; categories: WeeklyCategoryChange[] };
  forecast: Forecast;
};

export type CategoryGoal = {
  category: ExpenseCategory;
  goalAmount: number;
  spentAmount: number;
  remainingAmount: number;
  usagePercent: number;
};

export type CategoryGoals = {
  month: string;
  budgetAmount: number | null;
  goalTotalAmount: number;
  goalsExceedBudget: boolean;
  goals: CategoryGoal[];
};

export type CategoryGoalSaved = { month: string; category: ExpenseCategory; amount: number };
