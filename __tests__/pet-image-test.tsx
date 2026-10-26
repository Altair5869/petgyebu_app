import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';

import type { PetState, PetType } from '@/api/types';
import { PetImage } from '@/components/pet-image';
import { PET_IMAGES } from '@/lib/pet-images';

const CASES: [PetType, PetState][] = [
  ['CAT', 'STABLE'],
  ['CAT', 'CAUTION'],
  ['CAT', 'WARNING'],
  ['CAT', 'BUDGET_REACHED'],
  ['DOG', 'STABLE'],
  ['DOG', 'CAUTION'],
  ['DOG', 'WARNING'],
  ['DOG', 'BUDGET_REACHED'],
];

// Hidden elements are what a sighted user sees; screen readers skip them (home text says the same).
const SEEN = { includeHiddenElements: true };

test.each(CASES)('shows the %s %s placeholder, hidden from screen readers', async (petType, petState) => {
  await render(<PetImage petType={petType} petState={petState} images={{}} />);

  expect(isHiddenFromAccessibility(screen.getByTestId('pet-image', SEEN))).toBe(true);
  screen.getByText(petType, SEEN);
  screen.getByText(petState, SEEN);
  expect(screen.queryByText('임시 그림')).toBeNull();
  screen.getByText('임시 그림', SEEN);
});

test('shows a registered image instead of the placeholder, hidden from screen readers', async () => {
  await render(<PetImage petType="DOG" petState="WARNING" images={{ DOG: { WARNING: 1 } }} />);

  expect(isHiddenFromAccessibility(screen.getByTestId('pet-image', SEEN))).toBe(true);
  expect(screen.queryByText('임시 그림', SEEN)).toBeNull();
});

test('falls back to the placeholder for a state without an image', async () => {
  await render(<PetImage petType="DOG" petState="STABLE" images={{ DOG: { WARNING: 1 } }} />);

  screen.getByText('임시 그림', SEEN);
});

test.each(CASES)('registers the real %s %s image', (petType, petState) => {
  expect(PET_IMAGES[petType]?.[petState]).toBeDefined();
});
