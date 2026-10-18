import { fireEvent, render, screen } from '@testing-library/react-native';

import { ApiError } from '@/api/client';
import BudgetScreen from '@/app/budget';

const mockApi = { getBudget: jest.fn(), putBudget: jest.fn() };
const mockRefreshStage = jest.fn();

jest.mock('@/session/session-provider', () => ({
  useSession: () => ({ api: mockApi, refreshStage: mockRefreshStage }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRefreshStage.mockResolvedValue(undefined);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

test('prefills the previous month budget without saving it', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: 250000 });
  await render(<BudgetScreen />);

  await screen.findByText('지난달 예산을 불러왔어요');
  expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('250,000');
  expect(mockApi.putBudget).not.toHaveBeenCalled();
});

test('does not overwrite what the user typed with a late suggestion', async () => {
  const suggestion = deferred<{ month: string; amount: number }>();
  mockApi.getBudget.mockReturnValue(suggestion.promise);
  await render(<BudgetScreen />);

  await fireEvent.changeText(screen.getByLabelText('예산 금액'), '50000');
  suggestion.resolve({ month: '2026-09', amount: 250000 });

  await screen.findByDisplayValue('50,000');
  expect(screen.queryByText('지난달 예산을 불러왔어요')).toBeNull();
});

test('disables saving for amounts outside 1 to 100,000,000', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: null });
  await render(<BudgetScreen />);
  const input = screen.getByLabelText('예산 금액');

  await fireEvent.changeText(input, '0');
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  screen.getByText('1원부터 1억 원까지 입력할 수 있어요');

  await fireEvent.changeText(input, '100000001');
  expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
});

test('shows the server amount error and keeps the input', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: null });
  mockApi.putBudget.mockRejectedValue(
    new ApiError(400, 'INVALID_REQUEST', [{ field: 'amount', message: '금액을 확인해 주세요' }]),
  );
  await render(<BudgetScreen />);

  await fireEvent.changeText(screen.getByLabelText('예산 금액'), '300000');
  await fireEvent.press(screen.getByRole('button', { name: '저장' }));

  await screen.findByText('금액을 확인해 주세요');
  expect(screen.getByLabelText('예산 금액')).toHaveDisplayValue('300,000');
  expect(mockRefreshStage).not.toHaveBeenCalled();
});

test('sends one request when save is pressed twice', async () => {
  mockApi.getBudget.mockResolvedValue({ month: '2026-09', amount: null });
  mockApi.putBudget.mockReturnValue(new Promise(() => {}));
  await render(<BudgetScreen />);

  await fireEvent.changeText(screen.getByLabelText('예산 금액'), '300000');
  const save = screen.getByRole('button', { name: '저장' });
  await fireEvent.press(save);
  await fireEvent.press(save);

  expect(mockApi.putBudget).toHaveBeenCalledTimes(1);
  expect(mockApi.putBudget).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}$/), 300000);
});
