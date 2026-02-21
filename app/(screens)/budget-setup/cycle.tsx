import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
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
  cycleLengthForType,
  getBudgetSetupStepPath,
  getNextBudgetSetupStep,
  getPreviousBudgetSetupStep,
  CYCLE_PRESETS,
  WIZARD_TOTAL_STEPS,
  type CycleType,
} from '@/lib/budgetSetupFlow';

const CYCLE_NAME_KEY: Record<CycleType, string> = {
  monthly: 'cycleMonthly',
  semiMonthly: 'cycleSemiMonthly',
  biweekly: 'cycleBiweekly',
};

const CYCLE_DESC_KEY: Record<CycleType, string> = {
  monthly: 'cycleMonthlyDesc',
  semiMonthly: 'cycleSemiMonthlyDesc',
  biweekly: 'cycleBiweeklyDesc',
};

export default function BudgetSetupCycleScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const initial = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();

  const [cycleType, setCycleType] = React.useState<CycleType>(initial.cycleType);
  const [anchorDate, setAnchorDate] = React.useState(initial.anchorDate);

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '2')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  const buildState = () => ({
    ...initial,
    cycleType,
    cycleLengthDays: cycleLengthForType(cycleType),
    anchorDate: anchorDate.trim(),
  });

  const onBack = () => {
    const previousStep = getPreviousBudgetSetupStep('cycle');
    if (!previousStep) {
      router.replace('/budget-setup');
      return;
    }
    router.replace({
      pathname: getBudgetSetupStepPath(previousStep),
      params: { state: encodeSetupState(buildState()) },
    });
  };

  const onContinue = () => {
    const nextStep = getNextBudgetSetupStep('cycle');
    if (!nextStep) return;
    const state = buildState();
    router.replace({
      pathname: getBudgetSetupStepPath(nextStep),
      params: { state: encodeSetupState(state) },
    });
  };

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>
      <ThemedText
        style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }]}
      >
        {stepLabel}
      </ThemedText>

      <ThemedText type="title">{t(language, 'budgetSetupCycleTitle')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupCycleHelp')}
      </ThemedText>

      <View style={{ gap: spacing.md }}>
        {CYCLE_PRESETS.map((preset) => {
          const active = preset.type === cycleType;
          return (
            <Pressable key={preset.type} onPress={() => setCycleType(preset.type)}>
              <Card
                variant={active ? 'accent' : 'default'}
                style={active ? { borderColor: colors.primary, borderWidth: 2 } : undefined}
              >
                <View style={{ gap: spacing.xs }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                    {t(language, CYCLE_NAME_KEY[preset.type] as any)}
                  </ThemedText>
                  <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                    {t(language, CYCLE_DESC_KEY[preset.type] as any)}
                  </ThemedText>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="defaultSemiBold">{t(language, 'anchorDate')}</ThemedText>
          <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
            {t(language, 'budgetCycleAnchorHelp')}
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                borderRadius: borderRadius.md,
                borderColor: colors.borderLight,
                color: colors.text,
                backgroundColor: colors.backgroundCard,
                fontFamily: typography.body.fontFamily,
              },
            ]}
            value={anchorDate}
            onChangeText={setAnchorDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </Card>

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
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
});
