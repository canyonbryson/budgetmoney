import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { formatMoney } from '@/lib/money';
import {
  decodeSetupState,
  encodeSetupState,
  getBudgetSetupStepPath,
  getNextBudgetSetupStep,
  getPreviousBudgetSetupStep,
  WIZARD_TOTAL_STEPS,
} from '@/lib/budgetSetupFlow';

export default function BudgetSetupIncomeScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const initial = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();

  const [draft, setDraft] = React.useState(
    initial.incomePerCycle > 0 ? String(initial.incomePerCycle) : '',
  );
  const [error, setError] = React.useState<string | null>(null);

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '3')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  const parsed = Number(draft);
  const validAmount = Number.isFinite(parsed) && parsed >= 0;

  const buildState = () => ({ ...initial, incomePerCycle: parsed });

  const onBack = () => {
    const previousStep = getPreviousBudgetSetupStep('income');
    if (!previousStep) return;
    router.replace({
      pathname: getBudgetSetupStepPath(previousStep),
      params: { state: encodeSetupState(buildState()) },
    });
  };

  const onContinue = () => {
    if (!validAmount) {
      setError(t(language, 'invalidAmount'));
      return;
    }
    setError(null);
    const nextStep = getNextBudgetSetupStep('income');
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

      <ThemedText type="title">{t(language, 'budgetSetupIncomeTitle')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupIncomeHelp')}
      </ThemedText>

      <Card>
        <View style={{ gap: spacing.md }}>
          <ThemedText type="defaultSemiBold">{t(language, 'incomePerCycle')}</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                borderRadius: borderRadius.md,
                borderColor: colors.borderLight,
                color: colors.text,
                backgroundColor: colors.backgroundCard,
                fontFamily: typography.body.fontFamily,
                fontSize: 28,
                textAlign: 'center',
              },
            ]}
            keyboardType="numeric"
            value={draft}
            onChangeText={setDraft}
            autoFocus
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
          {validAmount && parsed > 0 && (
            <ThemedText style={[typography.body, { textAlign: 'center', color: colors.textMuted }]}>
              {formatMoney(parsed)}
            </ThemedText>
          )}
          {error ? (
            <ThemedText style={{ color: colors.error, textAlign: 'center' }}>{error}</ThemedText>
          ) : null}
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
    height: 64,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
});
