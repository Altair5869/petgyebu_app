import { render, screen } from '@testing-library/react-native';

import type { PetState, PetType } from '@/api/types';
import { PetImage } from '@/components/pet-image';

const CASES: [PetType, PetState, string][] = [
  ['CAT', 'STABLE', '고양이, 안정: 편안하게 지내고 있어요'],
  ['CAT', 'CAUTION', '고양이, 주의: 남은 예산을 눈여겨보고 있어요'],
  ['CAT', 'WARNING', '고양이, 경고: 남은 예산이 신경 쓰이는 눈치예요'],
  ['CAT', 'BUDGET_REACHED', '고양이, 예산 도달: 예산을 모두 사용했어요'],
  ['DOG', 'STABLE', '강아지, 안정: 편안하게 지내고 있어요'],
  ['DOG', 'CAUTION', '강아지, 주의: 남은 예산을 눈여겨보고 있어요'],
  ['DOG', 'WARNING', '강아지, 경고: 남은 예산이 신경 쓰이는 눈치예요'],
  ['DOG', 'BUDGET_REACHED', '강아지, 예산 도달: 예산을 모두 사용했어요'],
];

test.each(CASES)('shows the %s %s placeholder with its description', async (petType, petState, label) => {
  await render(<PetImage petType={petType} petState={petState} images={{}} />);

  const pet = screen.getByLabelText(label);
  expect(pet.props.accessibilityRole).toBe('image');
  screen.getByText(petType);
  screen.getByText(petState);
  screen.getByText('임시 그림');
});

test('shows a registered image instead of the placeholder', async () => {
  await render(<PetImage petType="DOG" petState="WARNING" images={{ DOG: { WARNING: 1 } }} />);

  screen.getByLabelText('강아지, 경고: 남은 예산이 신경 쓰이는 눈치예요');
  expect(screen.queryByText('임시 그림')).toBeNull();
});

test('falls back to the placeholder for a state without an image', async () => {
  await render(<PetImage petType="DOG" petState="STABLE" images={{ DOG: { WARNING: 1 } }} />);

  screen.getByText('임시 그림');
});
