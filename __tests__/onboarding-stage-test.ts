import { resolveStage } from '@/lib/onboarding-stage';

describe('resolveStage', () => {
  test('asks for a pet first when nothing is set', () => {
    expect(resolveStage(null, null)).toBe('pet');
  });

  test('asks for a pet even if a budget exists', () => {
    expect(resolveStage(null, 300000)).toBe('pet');
  });

  test('asks for a budget once the pet is chosen', () => {
    expect(resolveStage('CAT', null)).toBe('budget');
  });

  test('is ready when both are set', () => {
    expect(resolveStage('DOG', 300000)).toBe('ready');
  });
});
