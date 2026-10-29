import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { CategoryGoals, ExpenseCategory } from '@/api/types';
import { Button } from '@/components/button';
import { LoadingView, MessageView } from '@/components/message-view';
import { CONNECTION_ERROR, errorMessage } from '@/lib/error-message';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/expense';
import { type GoalAmounts, goalAmountsOf, goalInputTotal, parseGoalInput, planGoalSaves } from '@/lib/goals';
import { formatAmountInput, formatWon } from '@/lib/money';
import { monthName, monthTitle, parseMonthParam } from '@/lib/month';
import { CATEGORY_COLORS } from '@/lib/stats';
import { useSession } from '@/session/session-provider';
import { colors, contentWidth, fonts } from '@/theme';

type Texts = Record<ExpenseCategory, string>;
type Marks = Partial<Record<ExpenseCategory, string>>;

const EXCEED_MESSAGE = '목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요.';

function textsOf(amounts: GoalAmounts): Texts {
  const texts = {} as Texts;
  for (const category of CATEGORIES) {
    const amount = amounts[category];
    texts[category] = amount === undefined ? '' : formatAmountInput(String(amount));
  }
  return texts;
}

// Only meaningful when every field is valid.
function desiredOf(texts: Texts): GoalAmounts {
  const desired: GoalAmounts = {};
  for (const category of CATEGORIES) {
    const parsed = parseGoalInput(texts[category]);
    if (parsed.ok && parsed.amount !== null) desired[category] = parsed.amount;
  }
  return desired;
}

function differs(texts: Texts, server: GoalAmounts, category: ExpenseCategory): boolean {
  const parsed = parseGoalInput(texts[category]);
  return !parsed.ok || (parsed.amount ?? undefined) !== server[category];
}

export default function GoalsScreen() {
  const { api } = useSession();
  // The keyboard avoider measures itself from below the native header, so add the header back.
  const headerHeight = useHeaderHeight();
  const params = useLocalSearchParams<{ month?: string }>();
  const month = parseMonthParam(params.month);
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [budget, setBudget] = useState<number | null>(null);
  // The server's goals as last read; "changed" and "not saved" compare against these.
  const [server, setServer] = useState<GoalAmounts>({});
  const [exceeded, setExceeded] = useState(false);
  const [texts, setTexts] = useState<Texts>(() => textsOf({}));
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Marks>({});
  const [unsaved, setUnsaved] = useState<Partial<Record<ExpenseCategory, true>>>({});
  const generation = useRef(0);
  // Leaving mid-save lets the writes finish, but a gone screen must not update or go back again.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Runs on first display, on retry, and when coming back from adding the month budget.
  const load = useCallback(() => {
    if (!month) return;
    generation.current += 1;
    const gen = generation.current;
    setLoadState('loading');
    api.getCategoryGoals(month).then(
      (goals) => {
        if (gen !== generation.current) return;
        const amounts = goalAmountsOf(goals.goals);
        setBudget(goals.budgetAmount);
        setServer(amounts);
        setExceeded(goals.goalsExceedBudget);
        setTexts(textsOf(amounts));
        setSaveError(null);
        setFieldErrors({});
        setUnsaved({});
        setLoadState('ready');
      },
      () => {
        if (gen === generation.current) setLoadState('error');
      },
    );
  }, [api, month]);

  useFocusEffect(load);

  if (!month) return <MessageView message="잘못된 접근이에요" actionLabel="뒤로" onAction={() => router.back()} />;
  if (loadState === 'loading') return <LoadingView />;
  if (loadState === 'error') return <MessageView message={CONNECTION_ERROR} actionLabel="다시 시도" onAction={load} />;
  if (budget === null) {
    return (
      <MessageView
        message="목표를 정하려면 이 달 예산이 먼저 있어야 해요."
        actionLabel={`${monthName(month)} 예산 넣기`}
        onAction={() => router.push({ pathname: '/settings/budget', params: { month } })}
      />
    );
  }

  const total = goalInputTotal(texts);
  const left = budget - total;
  const invalid = CATEGORIES.some((c) => !parseGoalInput(texts[c]).ok);
  const changed = CATEGORIES.some((c) => differs(texts, server, c));

  function handleChange(category: ExpenseCategory, value: string) {
    setTexts((prev) => ({ ...prev, [category]: formatAmountInput(value) }));
    setFieldErrors((prev) => ({ ...prev, [category]: undefined }));
    setUnsaved((prev) => ({ ...prev, [category]: undefined }));
    setSaveError(null);
  }

  function applyServer(goals: CategoryGoals): GoalAmounts {
    const amounts = goalAmountsOf(goals.goals);
    if (!mounted.current) return amounts;
    setBudget(goals.budgetAmount);
    setServer(amounts);
    setExceeded(goals.goalsExceedBudget);
    return amounts;
  }

  function finish() {
    savingRef.current = false;
    if (mounted.current) setSaving(false);
  }

  async function handleFailure(e: unknown, category: ExpenseCategory, m: string) {
    if (!mounted.current) return;
    const amountError = e instanceof ApiError && e.status === 400 ? e.fieldMessage('amount') : undefined;
    if (amountError) {
      setFieldErrors({ [category]: amountError });
    } else {
      setSaveError((e instanceof ApiError && e.status === 409 && e.serverMessage) || errorMessage(e));
    }
    try {
      const amounts = applyServer(await api.getCategoryGoals(m));
      const marks: Partial<Record<ExpenseCategory, true>> = {};
      for (const c of CATEGORIES) if (differs(texts, amounts, c)) marks[c] = true;
      if (mounted.current) setUnsaved(marks);
    } catch {
      // Without the server's state no field can be marked; the error sentence stays.
    }
  }

  async function save(m: string) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    setUnsaved({});
    // Start from the server's current goals: another device or an earlier failed save may have changed them.
    let fresh: CategoryGoals;
    try {
      fresh = await api.getCategoryGoals(m);
    } catch (e) {
      if (mounted.current) setSaveError(errorMessage(e));
      finish();
      return;
    }
    const current = applyServer(fresh);
    if (fresh.budgetAmount === null) {
      finish();
      return;
    }
    if (goalInputTotal(texts) > fresh.budgetAmount) {
      if (mounted.current) setSaveError(EXCEED_MESSAGE);
      finish();
      return;
    }
    for (const op of planGoalSaves(current, desiredOf(texts), fresh.budgetAmount)) {
      try {
        if (op.kind === 'put') await api.putCategoryGoal(m, op.category, op.amount);
        else await api.deleteCategoryGoal(m, op.category);
      } catch (e) {
        await handleFailure(e, op.category, m);
        finish();
        return;
      }
    }
    if (mounted.current) router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.keyboardAvoiding}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.container}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{monthTitle(month)} 카테고리 목표</Text>
          {exceeded && <Text style={styles.error}>{EXCEED_MESSAGE}</Text>}
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              예산 {formatWon(budget)} · 목표 합 {formatWon(total)}
            </Text>
            {left >= 0 ? (
              <Text style={styles.summaryText}>
                더 정할 수 있는 금액 <Text style={styles.bold}>{formatWon(left)}</Text>
              </Text>
            ) : (
              <Text style={[styles.summaryText, styles.danger]}>
                예산보다 <Text style={styles.bold}>{formatWon(-left)}</Text> 많아요
              </Text>
            )}
          </View>
          <View style={styles.card}>
            {CATEGORIES.map((category) => {
              const parsed = parseGoalInput(texts[category]);
              return (
                <View key={category} style={styles.row}>
                  <View style={styles.rowTop}>
                    <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[category] }]} />
                    <Text style={styles.name}>{CATEGORY_LABELS[category]}</Text>
                    <TextInput
                      accessibilityLabel={`${CATEGORY_LABELS[category]} 목표 금액`}
                      keyboardType="number-pad"
                      value={texts[category]}
                      onChangeText={(value) => handleChange(category, value)}
                      editable={!saving}
                      placeholder="목표 없음"
                      placeholderTextColor={colors.muted}
                      selectionColor={colors.primary}
                      style={styles.input}
                    />
                    <Text style={styles.unit}>원</Text>
                  </View>
                  {!parsed.ok && <Text style={styles.error}>{parsed.error}</Text>}
                  {fieldErrors[category] && <Text style={styles.error}>{fieldErrors[category]}</Text>}
                  {unsaved[category] && <Text style={styles.error}>저장되지 않았어요</Text>}
                </View>
              );
            })}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          {saveError && !(exceeded && saveError === EXCEED_MESSAGE) && <Text style={styles.error}>{saveError}</Text>}
          <Button
            label="저장"
            onPress={() => void save(month)}
            disabled={!changed || invalid || left < 0}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  keyboardAvoiding: { flex: 1 },
  container: { ...contentWidth, padding: 24, gap: 24 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text },
  summary: { gap: 4, backgroundColor: colors.secondary, padding: 20, borderRadius: 24 },
  summaryText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bold: { fontFamily: fonts.bold },
  danger: { color: colors.danger },
  card: { gap: 16, backgroundColor: colors.surface, padding: 24, borderRadius: 24 },
  row: { gap: 4 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { width: 48, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    fontSize: 18,
    fontFamily: fonts.bold,
    textAlign: 'right',
    borderBottomWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  error: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
  footer: { ...contentWidth, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16, gap: 8 },
});
