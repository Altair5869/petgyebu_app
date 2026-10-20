import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, RequestTimeoutError } from '@/api/client';
import type { Me, PetType } from '@/api/types';
import { Button } from '@/components/button';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { formatWon } from '@/lib/money';
import { currentMonth, monthTitle } from '@/lib/month';
import { PET_LABELS } from '@/lib/pet';
import { useSession } from '@/session/session-provider';

const PET_TYPES: PetType[] = ['CAT', 'DOG'];
const PROVIDER_LABELS: Record<Me['provider'], string> = { KAKAO: '카카오로 로그인됨', GOOGLE: 'Google로 로그인됨' };
const DELETE_TIMEOUT = '탈퇴됐는지 확인하지 못했어요. 다시 시도해 주세요.';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; me: Me; budgetAmount: number | null };
type Busy = 'pet' | 'signOut' | 'delete' | null;

export default function SettingsScreen() {
  const { api, signOut, deleteAccount } = useSession();
  const month = currentMonth();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  // Account deletion can end with the session already signed out, which unmounts this screen.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Bumped when a pet save starts and ends; a fetch that overlapped a save may carry a stale pet.
  const petSaves = useRef(0);

  const fetchAll = useCallback(() => {
    const startedAt = petSaves.current;
    Promise.all([api.getMe(), api.getBudget(month)]).then(
      ([me, budget]) => {
        if (!mounted.current) return;
        // An odd count means a save is in flight right now.
        const stalePet = petSaves.current !== startedAt || petSaves.current % 2 === 1;
        setLoad((current) => ({
          status: 'ready',
          me: stalePet && current.status === 'ready' ? { ...me, petType: current.me.petType } : me,
          budgetAmount: budget.amount,
        }));
      },
      () => {
        if (mounted.current) setLoad((current) => (current.status === 'ready' ? current : { status: 'error' }));
      },
    );
  }, [api, month]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  function retry() {
    setLoad({ status: 'loading' });
    fetchAll();
  }

  async function changePet(next: PetType) {
    if (load.status !== 'ready' || busy || load.me.petType === next) return;
    const previous = load.me;
    setLoad({ ...load, me: { ...previous, petType: next } });
    setBusy('pet');
    setError(null);
    petSaves.current += 1;
    try {
      await api.putPet(next);
    } catch (e) {
      if (mounted.current) {
        setLoad((current) =>
          current.status === 'ready' ? { ...current, me: { ...current.me, petType: previous.petType } } : current,
        );
        setError(errorMessage(e));
      }
    }
    petSaves.current += 1;
    if (mounted.current) setBusy(null);
  }

  async function handleSignOut(provider: Me['provider']) {
    setBusy('signOut');
    setError(null);
    await signOut(provider);
    if (mounted.current) setBusy(null);
  }

  async function handleDelete(provider: Me['provider']) {
    setBusy('delete');
    setError(null);
    try {
      await deleteAccount(provider);
    } catch (e) {
      // 401: the session is already ending and routes to sign-in; show nothing on top of it.
      if (mounted.current && !(e instanceof ApiError && e.status === 401)) {
        setError(e instanceof RequestTimeoutError ? DELETE_TIMEOUT : errorMessage(e));
      }
    }
    if (mounted.current) setBusy(null);
  }

  function confirmDelete(provider: Me['provider']) {
    Alert.alert('회원 탈퇴할까요?', '지출과 예산 기록이 모두 삭제되고 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      { text: '탈퇴', style: 'destructive', onPress: () => void handleDelete(provider) },
    ]);
  }

  if (load.status === 'loading') return <LoadingView />;
  if (load.status === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={retry} />;

  const { me, budgetAmount } = load;
  const locked = busy !== null;
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>펫</Text>
          <View style={styles.pets}>
            {PET_TYPES.map((type) => (
              <Pressable
                key={type}
                accessibilityRole="radio"
                accessibilityLabel={PET_LABELS[type]}
                accessibilityState={{ selected: me.petType === type, disabled: locked }}
                disabled={locked}
                onPress={() => void changePet(type)}
                style={[styles.pet, me.petType === type && styles.petSelected]}>
                <Text style={styles.petLabel}>{PET_LABELS[type]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{monthTitle(month)} 예산</Text>
          <Text style={styles.amount}>{budgetAmount === null ? '설정 안 됨' : formatWon(budgetAmount)}</Text>
          <Button label="변경" onPress={() => router.push('/settings/budget')} disabled={locked} />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>계정</Text>
          <Text style={styles.body}>{PROVIDER_LABELS[me.provider]}</Text>
          <Button label="로그아웃" onPress={() => void handleSignOut(me.provider)} loading={busy === 'signOut'} disabled={locked} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="회원 탈퇴"
            disabled={locked}
            onPress={() => confirmDelete(me.provider)}
            style={locked && styles.inactive}>
            <Text style={styles.danger}>회원 탈퇴</Text>
          </Pressable>
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 24, gap: 16 },
  card: { borderRadius: 16, backgroundColor: '#F5F7FA', padding: 20, gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  pets: { flexDirection: 'row', gap: 12 },
  pet: { flex: 1, paddingVertical: 16, borderRadius: 12, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#fff' },
  petSelected: { borderColor: '#208AEF', backgroundColor: '#EAF4FE' },
  petLabel: { fontSize: 18, fontWeight: '600', color: '#111' },
  amount: { fontSize: 24, fontWeight: '700', color: '#111' },
  body: { fontSize: 16, color: '#333' },
  danger: { fontSize: 16, color: '#D93025', textAlign: 'center', paddingVertical: 8 },
  inactive: { opacity: 0.4 },
  error: { color: '#D93025', textAlign: 'center' },
});
