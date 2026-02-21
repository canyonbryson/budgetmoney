import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import {
  decodeSetupState,
  encodeSetupState,
  getBudgetSetupStepPath,
  getNextBudgetSetupStep,
  getPreviousBudgetSetupStep,
  WIZARD_TOTAL_STEPS,
  type BudgetSetupCategoryDraft,
  type RolloverMode,
} from '@/lib/budgetSetupFlow';
import type { TranslationKey } from '@/i18n';

const ROLLOVER_OPTIONS: { mode: RolloverMode; labelKey: TranslationKey }[] = [
  { mode: 'none', labelKey: 'rolloverNone' },
  { mode: 'positive', labelKey: 'rolloverPositive' },
  { mode: 'negative', labelKey: 'rolloverNegative' },
  { mode: 'both', labelKey: 'rolloverBoth' },
];

export default function BudgetSetupCarryoverScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const initial = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();

  const [categories, setCategories] = React.useState<BudgetSetupCategoryDraft[]>(initial.categories);

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '6')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  const setCatRollover = (idx: number, mode: RolloverMode) => {
    setCategories((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, rolloverMode: mode } : c)),
    );
  };

  const setSubRollover = (catIdx: number, subIdx: number, mode: RolloverMode) => {
    setCategories((prev) =>
      prev.map((c, ci) =>
        ci === catIdx
          ? {
              ...c,
              subcategories: c.subcategories.map((s, si) =>
                si === subIdx ? { ...s, rolloverMode: mode } : s,
              ),
            }
          : c,
      ),
    );
  };

  const buildState = () => ({ ...initial, categories });

  const onBack = () => {
    const previousStep = getPreviousBudgetSetupStep('carryover');
    if (!previousStep) return;
    router.replace({
      pathname: getBudgetSetupStepPath(previousStep),
      params: { state: encodeSetupState(buildState()) },
    });
  };

  const onContinue = () => {
    const nextStep = getNextBudgetSetupStep('carryover');
    if (!nextStep) return;
    const state = buildState();
    router.replace({
      pathname: getBudgetSetupStepPath(nextStep),
      params: { state: encodeSetupState(state) },
    });
  };

  function RolloverPills({
    current,
    onSelect,
  }: {
    current: RolloverMode;
    onSelect: (mode: RolloverMode) => void;
  }) {
    return (
      <View style={[styles.row, { gap: spacing.xs, flexWrap: 'wrap' }]}>
        {ROLLOVER_OPTIONS.map(({ mode, labelKey }) => {
          const active = current === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => onSelect(mode)}
              style={[
                styles.pill,
                {
                  borderRadius: borderRadius.pill,
                  borderColor: colors.borderLight,
                },
                active && {
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.primary,
                },
              ]}
            >
              <ThemedText
                style={[
                  typography.caption,
                  active && { fontWeight: '600', color: colors.primary },
                ]}
              >
                {t(language, labelKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>
      <ThemedText
        style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }]}
      >
        {stepLabel}
      </ThemedText>

      <ThemedText type="title">{t(language, 'budgetSetupCarryoverTitle')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupCarryoverHelp')}
      </ThemedText>

      <View style={{ gap: spacing.md }}>
        {categories.map((cat, idx) => (
          <Card key={idx}>
            <View style={{ gap: spacing.sm }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                {cat.name}
              </ThemedText>
              <RolloverPills
                current={cat.rolloverMode}
                onSelect={(mode) => setCatRollover(idx, mode)}
              />

              {cat.subcategories.length > 0 && (
                <View
                  style={{
                    gap: spacing.sm,
                    paddingLeft: spacing.md,
                    borderLeftWidth: 2,
                    borderLeftColor: colors.borderLight,
                    marginTop: spacing.xs,
                  }}
                >
                  {cat.subcategories.map((sub, subIdx) => (
                    <View key={subIdx} style={{ gap: spacing.xs }}>
                      <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                        {sub.name}
                      </ThemedText>
                      <RolloverPills
                        current={sub.rolloverMode}
                        onSelect={(mode) => setSubRollover(idx, subIdx, mode)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>
        ))}
      </View>

      <View style={[styles.row, { gap: spacing.sm }]}>
        <Button variant="outline" style={{ flex: 1 }} onPress={onBack}>
          {t(language, 'back')}
        </Button>
        <Button style={{ flex: 1 }} onPress={onContinue}>
          {t(language, 'continue')}
        </Button>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
