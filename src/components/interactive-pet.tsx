import { Image, type ImageRef } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import type { PetState, PetType } from '@/api/types';
import { PetImage } from '@/components/pet-image';
import { CAT_FRAMES } from '@/lib/cat-frames';
import { DOG_FRAMES } from '@/lib/dog-frames';
import { createPetInteraction, type PetPose, type PetReaction } from '@/lib/pet-interaction';

const HEADS: Record<PetType, Record<PetState, { left: number; top: number; width: number }>> = {
  CAT: {
    STABLE: { left: 0.30, top: 0.12, width: 0.44 },
    CAUTION: { left: 0.33, top: 0.15, width: 0.43 },
    WARNING: { left: 0.27, top: 0.12, width: 0.45 },
    BUDGET_REACHED: { left: 0.27, top: 0.12, width: 0.45 },
  },
  DOG: {
    STABLE: { left: 0.32, top: 0.23, width: 0.40 },
    CAUTION: { left: 0.39, top: 0.28, width: 0.38 },
    WARNING: { left: 0.30, top: 0.25, width: 0.40 },
    BUDGET_REACHED: { left: 0.30, top: 0.25, width: 0.40 },
  },
};
const FRAMES = { CAT: CAT_FRAMES, DOG: DOG_FRAMES };
type Props = { petType: PetType; petState: PetState; focused: boolean };

export function InteractivePet(props: Props) {
  // Changing species cancels the old reaction and pending image decoding.
  return <PetAnimation key={props.petType} {...props} />;
}

function PetAnimation({ petType, petState, focused }: Props) {
  const id = petType === 'CAT' ? 'cat' : 'dog';
  const name = petType === 'CAT' ? '고양이' : '강아지';
  const [reaction, setReaction] = useState<PetReaction>(null);
  const [motion] = useState(() => createPetInteraction(setReaction));
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [loaded, setLoaded] = useState<{ state: PetState; frames: Record<PetPose, ImageRef> }>();
  const displayState = reaction?.state ?? petState;
  const pose = reaction?.pose ?? 'open';
  const ready = loaded?.state === displayState;

  useEffect(() => {
    let alive = true;
    let preferenceChanged = false;
    const accessibility = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      preferenceChanged = true;
      setReduced(value);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive && !preferenceChanged) setReduced(value);
    }).catch(() => { /* Keep the conservative no-idle setting. */ });
    const appState = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    // Android notification shade focus events are unsupported by iOS RCTAppState.
    const blur = Platform.OS === 'android' ? AppState.addEventListener('blur', () => setForeground(false)) : undefined;
    const focus = Platform.OS === 'android' ? AppState.addEventListener('focus', () => setForeground(AppState.currentState === 'active')) : undefined;
    return () => { alive = false; accessibility.remove(); appState.remove(); blur?.remove(); focus?.remove(); };
  }, []);

  useEffect(() => {
    let alive = true;
    const sources = FRAMES[petType][displayState];
    Promise.all([sources.open, sources.half, sources.closed].map((source) => Image.loadAsync(source))).then(([open, half, closed]) => {
      if (alive) setLoaded({ state: displayState, frames: { open, half, closed } });
    }).catch(() => { /* Keep the existing static pet if a frame fails to decode. */ });
    return () => { alive = false; };
  }, [displayState, petType]);

  useEffect(() => {
    motion.update({ state: petState, enabled: focused && foreground && ready, reducedMotion: reduced });
  }, [motion, petState, focused, foreground, ready, reduced]);
  useEffect(() => () => motion.dispose(), [motion]);

  const head = HEADS[petType][displayState];
  return (
    <View style={styles.art} testID={`interactive-${id}`}>
      {ready ? (
        <Image source={loaded.frames[pose]} contentFit="contain" transition={0} style={styles.art}
          testID={`${id}-frame-${displayState}-${pose}`} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
      ) : <PetImage petType={petType} petState={displayState} size="home" />}
      <Pressable
        testID={`${id}-head`}
        accessibilityRole="button"
        accessibilityLabel={`${name} 쓰다듬기`}
        accessibilityHint={petType === 'CAT' ? '머리를 쓰다듬으면 잠깐 눈을 감아요' : '머리를 쓰다듬으면 잠깐 편안한 눈매가 돼요'}
        disabled={!ready || !focused || !foreground}
        hitSlop={8}
        style={[styles.head, { left: head.left * 155, top: head.top * 120, width: head.width * 155 }]}
        onPressIn={motion.pressIn}
        onPressOut={motion.pressOut}
        onPress={motion.activate}
        onTouchCancel={motion.cancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  art: { width: 155, height: 120, alignSelf: 'center' },
  head: { position: 'absolute', height: 33 },
});
