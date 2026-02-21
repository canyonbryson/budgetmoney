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
import { decodeSetupState, encodeSetupState } from '@/lib/budgetSetupFlow';

export default function BudgetSetupAmountsScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const initial = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();
  const [cycleLength, setCycleLength] = React.useState(String(initial.cycleLengthDays));
  const [anchorDate, setAnchorDate] = React.useState(initial.anchorDate);
  const [amounts, setAmounts] = React.useState<Record<string, string>>(
    Object.fromEntries(initial.categories.map((row) => [row.name, String(row.amount)]))
  );
  const [error, setError] = React.useState<string | null>(null);

  const onContinue = () => {
    const parsedCycle = Number(cycleLength);
    if (!Number.isFinite(parsedCycle) || parsedCycle < 1) {
      setError(t(language, 'invalidAmount'));
      return;
    }
    const categories = initial.categories.map((row) => {
      const value = Number(amounts[row.name] ?? 0);
      return { name: row.name, amount: Number.isFinite(value) ? value : 0 };
    });
    const state = {
      ...initial,
      cycleLengthDays: Math.round(parsedCycle),
      anchorDate: anchorDate.trim(),
      categories,
    };
    setError(null);
    router.push({
      pathname: '/(screens)/budget-setup/review',
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
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'budgetSetupStepAmounts')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>{t(language, 'budgetSetupAmountsHelp')}</ThemedText>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="defaultSemiBold">{t(language, 'budgetCycle')}</ThemedText>
          <TextInput
            style={inputStyle}
            keyboardType="numeric"
            value={cycleLength}
            onChangeText={setCycleLength}
            placeholder={t(language, 'cycleLengthDays')}
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={inputStyle}
            value={anchorDate}
            onChangeText={setAnchorDate}
            placeholder={t(language, 'anchorDate')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="defaultSemiBold">{t(language, 'budgetSetupCategoryAmounts')}</ThemedText>
          {initial.categories.map((row) => (
            <View key={row.name} style={{ gap: 4 }}>
              <ThemedText>{row.name}</ThemedText>
              <TextInput
                style={inputStyle}
                keyboardType="numeric"
                value={amounts[row.name] ?? '0'}
                onChangeText={(value) => setAmounts((prev) => ({ ...prev, [row.name]: value }))}
                placeholder={t(language, 'amount')}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ))}
          {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
        </View>
      </Card>

      <Button onPress={onContinue}>{t(language, 'continue')}</Button>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
});
