import { createPetInteraction } from '@/lib/pet-interaction';
import type { PetState } from '@/api/types';

beforeEach(() => { jest.useFakeTimers(); jest.spyOn(Math, 'random').mockReturnValue(0); });
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); jest.restoreAllMocks(); });

function setup(state: PetState = 'STABLE', reducedMotion = false) {
  const publish = jest.fn();
  const motion = createPetInteraction(publish);
  motion.update({ state, reducedMotion, enabled: true });
  return { motion, publish };
}

test.each<PetState>(['STABLE', 'CAUTION', 'WARNING', 'BUDGET_REACHED'])('%s petting recovers after release', (state) => {
  const { motion, publish } = setup(state);
  motion.pressIn();
  expect(publish).toHaveBeenLastCalledWith({ state, pose: 'half' });
  jest.advanceTimersByTime(100);
  expect(publish).toHaveBeenLastCalledWith({ state, pose: 'closed' });
  motion.pressOut();
  motion.activate(); // Native Pressable also fires onPress after onPressOut.
  jest.advanceTimersByTime(120);
  expect(publish).toHaveBeenLastCalledWith({ state, pose: 'half' });
  jest.advanceTimersByTime(120);
  expect(publish).toHaveBeenLastCalledWith(null);
  motion.dispose();
});

test('a response holds its starting emotion and returns to the latest budget', () => {
  const { motion, publish } = setup();
  motion.pressIn();
  motion.update({ state: 'CAUTION', enabled: true, reducedMotion: false });
  motion.update({ state: 'BUDGET_REACHED', enabled: true, reducedMotion: false });
  jest.advanceTimersByTime(100);
  expect(publish).toHaveBeenLastCalledWith({ state: 'STABLE', pose: 'closed' });
  motion.pressOut();
  jest.advanceTimersByTime(240);
  expect(publish).toHaveBeenLastCalledWith(null);
  expect(jest.getTimerCount()).toBe(0);
  motion.pressIn();
  expect(publish).toHaveBeenLastCalledWith({ state: 'BUDGET_REACHED', pose: 'half' });
});

test('idle blinks every 4–7 seconds, but not at budget reached', () => {
  const { motion, publish } = setup();
  jest.advanceTimersByTime(4000);
  expect(publish).toHaveBeenLastCalledWith({ state: 'STABLE', pose: 'half' });
  jest.advanceTimersByTime(90);
  expect(publish).toHaveBeenLastCalledWith({ state: 'STABLE', pose: 'closed' });
  jest.advanceTimersByTime(180);
  expect(publish).toHaveBeenLastCalledWith(null);
  motion.update({ state: 'BUDGET_REACHED', enabled: true, reducedMotion: false });
  expect(jest.getTimerCount()).toBe(0);
});

test('reduced motion uses one static reaction and does not replay on native onPress', () => {
  const { motion, publish } = setup('CAUTION', true);
  expect(jest.getTimerCount()).toBe(0);
  motion.pressIn();
  expect(publish).toHaveBeenLastCalledWith({ state: 'CAUTION', pose: 'closed' });
  motion.pressOut();
  motion.activate();
  jest.runOnlyPendingTimers();
  expect(publish).toHaveBeenLastCalledWith(null);
  expect(jest.getTimerCount()).toBe(0);
});

test('screen reader activation without press events completes; cancellation recovers', () => {
  const { motion, publish } = setup();
  motion.activate();
  jest.advanceTimersByTime(1090);
  expect(publish).toHaveBeenLastCalledWith(null);
  motion.pressIn();
  motion.cancel();
  expect(publish).toHaveBeenLastCalledWith(null);
});

test('leaving the screen/app and unmounting clear all timers', () => {
  const { motion, publish } = setup();
  motion.pressIn();
  motion.update({ state: 'WARNING', enabled: false, reducedMotion: false });
  expect(publish).toHaveBeenLastCalledWith(null);
  expect(jest.getTimerCount()).toBe(0);
  motion.activate();
  expect(jest.getTimerCount()).toBe(0);
  motion.update({ state: 'WARNING', enabled: true, reducedMotion: false });
  motion.pressIn();
  motion.dispose();
  const count = publish.mock.calls.length;
  jest.runOnlyPendingTimers();
  expect(publish).toHaveBeenCalledTimes(count);
});
