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

export default function BudgetSetupAllocationScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const initial = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();

  /* Per-category and per-subcategory amount drafts keyed by "catIdx" and "catIdx-subIdx" */
  const [drafts, setDrafts] = React.useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    initial.categories.forEach((cat, ci) => {
      d[String(ci)] = String(cat.amount);
      cat.subcategories.forEach((sub, si) => {
        d[`${ci}-${si}`] = String(sub.amount);
      });
    });
    return d;
  });
  const [error, setError] = React.useState<string | null>(null);

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '5')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  const onChangeDraft = (key: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: value }));
  };

  /* Compute totals */
  const parseDraft = (key: string) => {
    const val = Number(drafts[key] ?? 0);
    return Number.isFinite(val) ? val : 0;
  };

  const totalAllocated = initial.categories.reduce((sum, _, ci) => sum + parseDraft(String(ci)), 0);

  const buildState = () => {
    const categories = initial.categories.map((cat, ci) => ({
      ...cat,
      amount: parseDraft(String(ci)),
      subcategories: cat.subcategories.map((sub, si) => ({
        ...sub,
        amount: parseDraft(`${ci}-${si}`),
      })),
    }));
    return { ...initial, categories };
  };

  const onBack = () => {
    const previousStep = getPreviousBudgetSetupStep('allocation');
    if (!previousStep) return;
    router.replace({
      pathname: getBudgetSetupStepPath(previousStep),
      params: { state: encodeSetupState(buildState()) },
    });
  };

  const onContinue = () => {
    /* Validate: subcategory totals must match parent */
    for (let ci = 0; ci < initial.categories.length; ci++) {
      const cat = initial.categories[ci];
      if (cat.subcategories.length === 0) continue;
      const parentAmt = parseDraft(String(ci));
      const subTotal = cat.subcategories.reduce((sum, _, si) => sum + parseDraft(`${ci}-${si}`), 0);
      if (Math.abs(subTotal - parentAmt) > 0.01) {
        setError(
          `${cat.name}: ${t(language, 'subcategoryTotal')} (${formatMoney(subTotal)}) ≠ ${formatMoney(parentAmt)}`,
        );
        return;
      }
    }

    setError(null);
    const nextStep = getNextBudgetSetupStep('allocation');
    if (!nextStep) return;
    const state = buildState();
    router.replace({
      pathname: getBudgetSetupStepPath(nextStep),
      params: { state: encodeSetupState(state) },
    });
  };

  const inputStyle = [
    styles.input,
    {
      borderRadius: borderRadius.md,
      borderColor: colors.borderLight,
      color: colors.text,
      backgroundColor: colors.backgroundCard,
      fontFamily: typography.body.fontFamily,
    },
  ];

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>
      <ThemedText
        style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }]}
      >
        {stepLabel}
      </ThemedText>

      <ThemedText type="title">{t(language, 'budgetSetupAllocationTitle')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupAllocationHelp')}
      </ThemedText>

      {/* Income reference */}
      {initial.incomePerCycle > 0 && (
        <Card variant="muted">
          <View style={styles.summaryRow}>
            <ThemedText style={[typography.body, { color: colors.textMuted }]}>
              {t(language, 'budgetSetupReviewIncome')}
            </ThemedText>
            <ThemedText type="defaultSemiBold">{formatMoney(initial.incomePerCycle)}</ThemedText>
          </View>
          <View style={[styles.summaryRow, { marginTop: spacing.xs }]}>
            <ThemedText style={[typography.body, { color: colors.textMuted }]}>
              {t(language, 'totalAllocated')}
            </ThemedText>
            <ThemedText
              type="defaultSemiBold"
              style={{
                color: totalAllocated > initial.incomePerCycle ? colors.error : colors.text,
              }}
            >
              {formatMoney(totalAllocated)}
            </ThemedText>
          </View>
        </Card>
      )}

      {/* Per-category allocation */}
      <View style={{ gap: spacing.md }}>
        {initial.categories.map((cat, ci) => {
          const hasSubs = cat.subcategories.length > 0;
          const subTotal = hasSubs
            ? cat.subcategories.reduce((sum, _, si) => sum + parseDraft(`${ci}-${si}`), 0)
            : 0;
          const subMismatch = hasSubs && Math.abs(subTotal - parseDraft(String(ci))) > 0.01;

          return (
            <Card key={ci}>
              <View style={{ gap: spacing.sm }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 16 }}>
                  {cat.name}
                </ThemedText>
                <TextInput
                  style={[inputStyle, { fontSize: 20 }]}
                  keyboardType="numeric"
                  value={drafts[String(ci)] ?? '0'}
                  onChangeText={(val) => onChangeDraft(String(ci), val)}
                  placeholder={t(language, 'amount')}
                  placeholderTextColor={colors.textMuted}
                />

                {/* Subcategory amounts */}
                {hasSubs && (
                  <View
                    style={{
                      gap: spacing.sm,
                      paddingLeft: spacing.md,
                      borderLeftWidth: 2,
                      borderLeftColor: colors.borderLight,
                    }}
                  >
                    {cat.subcategories.map((sub, si) => (
                      <View key={si} style={{ gap: 4 }}>
                        <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                          {sub.name}
                        </ThemedText>
                        <TextInput
                          style={inputStyle}
                          keyboardType="numeric"
                          value={drafts[`${ci}-${si}`] ?? '0'}
                          onChangeText={(val) => onChangeDraft(`${ci}-${si}`, val)}
                          placeholder={t(language, 'amount')}
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
                    ))}
                    <View style={styles.summaryRow}>
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {t(language, 'subcategoryTotal')}
                      </ThemedText>
                      <ThemedText
                        style={[
                          typography.caption,
                          { color: subMismatch ? colors.error : colors.textMuted },
                        ]}
                      >
                        {formatMoney(subTotal)}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </View>
            </Card>
          );
        })}
      </View>

      {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}

      <View style={[styles.summaryRow, { gap: spacing.sm }]}>
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
});
