import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CategoryGoals, ExpenseCategory } from '@/api/types';
import { Button } from '@/components/button';
import { CATEGORY_LABELS } from '@/lib/expense';
import { goalBarPercent, goalProgressText, goalRemaining, goalRowLabel } from '@/lib/goals';
import { monthName } from '@/lib/month';
import { CATEGORY_COLORS } from '@/lib/stats';
import { colors, fonts } from '@/theme';

type Props = {
  goals: CategoryGoals;
  onEditGoals: () => void;
  onAddBudget: () => void;
  onSelect: (category: ExpenseCategory) => void;
};

export function CategoryGoalsCard({ goals, onEditGoals, onAddBudget, onSelect }: Props) {
  const hasGoals = goals.goals.length > 0;
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>카테고리 목표</Text>
        {hasGoals && (
          <Pressable accessibilityRole="button" accessibilityLabel="카테고리 목표 고치기" onPress={onEditGoals} hitSlop={8} style={styles.edit}>
            <Text style={styles.link}>고치기 ›</Text>
          </Pressable>
        )}
      </View>
      {goals.budgetAmount === null ? (
        <>
          <Text style={styles.message}>목표를 정하려면 이 달 예산이 먼저 있어야 해요.</Text>
          <Button label={`${monthName(goals.month)} 예산 넣기`} onPress={onAddBudget} />
        </>
      ) : !hasGoals ? (
        <>
          <Text style={styles.message}>이 달에 정한 목표가 없어요.</Text>
          <Button label="목표 정하기" variant="secondary" onPress={onEditGoals} />
        </>
      ) : (
        <>
          {goals.goalsExceedBudget && (
            <Text style={styles.warning}>목표 합이 예산보다 커요. 목표를 줄이거나 예산을 올려 주세요.</Text>
          )}
          {goals.goals.map((goal) => {
            const remaining = goalRemaining(goal.remainingAmount);
            return (
              <Pressable
                key={goal.category}
                accessibilityRole="button"
                accessibilityLabel={goalRowLabel(goal)}
                onPress={() => onSelect(goal.category)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{CATEGORY_LABELS[goal.category]}</Text>
                  <Text style={[styles.remaining, remaining.over && styles.over]}>{remaining.text}</Text>
                </View>
                <View style={styles.track}>
                  <View
                    testID={`goal-bar-${goal.category}`}
                    style={{
                      width: `${goalBarPercent(goal.usagePercent)}%`,
                      height: '100%',
                      backgroundColor: remaining.over ? colors.danger : CATEGORY_COLORS[goal.category],
                    }}
                  />
                </View>
                <Text style={styles.progress}>{goalProgressText(goal)}</Text>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 24, padding: 24, gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.text },
  edit: { minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: fonts.bold, fontSize: 15, color: colors.primary },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.muted },
  warning: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.danger },
  row: { gap: 8, minHeight: 44 },
  pressed: { opacity: 0.8 },
  rowTop: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  remaining: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, fontVariant: ['tabular-nums'] },
  over: { color: colors.danger },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.border },
  progress: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, fontVariant: ['tabular-nums'] },
});
