import type { PetState } from '@/api/types';

export type PetPose = 'open' | 'half' | 'closed';
export type PetReaction = { state: PetState; pose: PetPose } | null;
type Options = { state: PetState; enabled: boolean; reducedMotion: boolean };

// No budget writes: transient artwork holds its starting state; null uses the latest home state.
export function createPetInteraction(publish: (frame: PetReaction) => void) {
  let options: Options = { state: 'STABLE', enabled: false, reducedMotion: true };
  let reaction: { state: PetState; kind: 'blink' | 'pet' } | null = null;
  let timers: ReturnType<typeof setTimeout>[] = [];
  let idle: ReturnType<typeof setTimeout> | undefined;
  let suppressActivation = false;
  const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
  const clear = () => { timers.forEach(clearTimeout); timers = []; clearTimeout(idle); };
  const show = (pose: PetPose) => { if (reaction) publish({ state: reaction.state, pose }); };

  function schedule() {
    clearTimeout(idle);
    if (!options.enabled || options.reducedMotion || reaction || options.state === 'BUDGET_REACHED') return;
    idle = setTimeout(() => {
      reaction = { state: options.state, kind: 'blink' };
      show('half');
      later(() => show('closed'), 90);
      later(() => show('half'), 180);
      later(finish, 270);
    }, 4000 + Math.random() * 3000);
  }

  function finish() {
    clear();
    reaction = null;
    publish(null);
    schedule();
  }

  function pressIn() {
    if (!options.enabled) return;
    suppressActivation = false;
    clear();
    reaction = { state: options.state, kind: 'pet' };
    show(options.reducedMotion ? 'closed' : 'half');
    if (!options.reducedMotion) later(() => show('closed'), 100);
  }

  function pressOut() {
    if (reaction?.kind !== 'pet') return;
    clear();
    if (options.reducedMotion) finish();
    else {
      show('closed');
      later(() => show('half'), 120);
      later(finish, 240);
    }
    suppressActivation = true;
    later(() => { suppressActivation = false; }, 0);
  }

  return {
    update(next: Options) {
      const reset = next.enabled !== options.enabled || next.reducedMotion !== options.reducedMotion;
      options = next;
      if (reset || !next.enabled) finish();
      else schedule();
    },
    pressIn,
    pressOut,
    // Screen reader / keyboard activation may arrive without pressIn/pressOut.
    activate() {
      if (suppressActivation) { suppressActivation = false; return; }
      if (reaction?.kind === 'pet') return;
      pressIn();
      if (reaction) later(pressOut, 850);
    },
    cancel: finish,
    dispose() { clear(); reaction = null; },
  };
}
