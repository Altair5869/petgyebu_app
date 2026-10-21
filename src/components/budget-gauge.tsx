import { StyleSheet, Text, View } from 'react-native';

import type { PetState } from '@/api/types';
import { remainingBudgetRatio } from '@/lib/pet';

// Colors sampled from the pet artwork's original gauge; BUDGET_REACHED has nothing left to fill.
const FILL_COLORS: Record<PetState, string> = {
  STABLE: '#A9DB66',
  CAUTION: '#FED16C',
  WARNING: '#FD9457',
  BUDGET_REACHED: '#FD9457',
};

type BudgetGaugeProps = { petState: PetState; budgetAmount: number; budgetBalanceAmount: number };

// The bar the pet sits on: how much of this month's budget is left. The balance card below says the
// same in words, so screen readers skip the bar (as they skip the picture).
export function BudgetGauge({ petState, budgetAmount, budgetBalanceAmount }: BudgetGaugeProps) {
  const ratio = remainingBudgetRatio(budgetAmount, budgetBalanceAmount);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.wrap}>
      <View style={styles.outer}>
        <View style={styles.track}>
          {ratio > 0 && (
            <View
              testID="budget-gauge-fill"
              style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: FILL_COLORS[petState] }]}
            />
          )}
        </View>
      </View>
      <Text style={styles.caption}>남은 예산</Text>
    </View>
  );
}

const BROWN = '#4E2617';
const CREAM = '#FCF2E6';

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  // Same width as the gauge the artwork was exported against (scripts/export-pet-images.py).
  outer: { width: 120, height: 19, borderRadius: 9.5, borderWidth: 2.5, borderColor: BROWN, backgroundColor: CREAM, padding: 2 },
  track: { flex: 1, borderRadius: 6, borderWidth: 1.5, borderColor: BROWN, backgroundColor: CREAM, overflow: 'hidden' },
  // A sliver of budget still shows as a round dot rather than vanishing.
  fill: { height: '100%', minWidth: 7, borderRadius: 6 },
  caption: { fontSize: 12, color: '#666' },
});
