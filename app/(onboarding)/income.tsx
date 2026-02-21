import React from 'react';
import { TextInput, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/convex/_generated/api';
import { getBudgetSettings, updateBudgetSettings } from '@/lib/localDb';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

export function parseMonthlyIncomeInput(rawValue: string): number | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN;
  return parsed;
}

export default function OnboardingIncomeScreen() {
  const { owner, isSignedIn } = useIdentity();
  const { language } = useSettings();
  const { bumpRefresh } = useLocalDb();
  const { colors, borderRadius, typography } = useAppTheme();
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const settings = useQuery(
    api.budgets.getSettings,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localSettings = useLocalQuery(getBudgetSettings, [], !isSignedIn);
  const updateSettings = useMutation(api.budgets.updateSettings);

  const onContinue = async () => {
    if (!owner || saving) return;
    const parsed = parseMonthlyIncomeInput(value);
    if (parsed === null) {
      setError(null);
      router.push('/(onboarding)/budget');
      return;
    }
    if (!Number.isFinite(parsed)) {
      setError(t(language, 'onboardingIncomeInvalid'));
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const cycleLengthDays = isSignedIn
        ? (settings?.cycleLengthDays ?? 30)
        : (localSettings.data?.cycleLengthDays ?? 30);
      const anchorDate = isSignedIn
        ? (settings?.anchorDate ?? new Date().toISOString().slice(0, 10))
        : (localSettings.data?.anchorDate ?? new Date().toISOString().slice(0, 10));

      if (isSignedIn) {
        await updateSettings({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          cycleLengthDays,
          anchorDate,
          monthlyIncome: parsed,
        });
      } else {
        await updateBudgetSettings(cycleLengthDays, anchorDate, parsed);
        bumpRefresh();
      }
      router.push('/(onboarding)/budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      step={4}
      total={9}
      title={t(language, 'onboardingIncomeTitle')}
      subtitle={t(language, 'onboardingIncomeSubtitle')}
    >
      <Card>
        <View style={{ gap: 8 }}>
          <ThemedText>{t(language, 'monthlyIncome')}</ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                borderRadius: borderRadius.md,
                borderColor: colors.borderLight,
                color: colors.text,
                fontFamily: typography.body.fontFamily,
                backgroundColor: colors.backgroundCard,
              },
            ]}
            keyboardType="numeric"
            placeholder="e.g. 5000"
            placeholderTextColor={colors.textMuted}
            value={value}
            onChangeText={setValue}
          />
          {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
        </View>
      </Card>

      <Button onPress={onContinue} disabled={saving}>
        {saving ? t(language, 'budgetSetupSaving') : t(language, 'continue')}
      </Button>
      <Button
        variant="secondary"
        onPress={() => router.push('/(onboarding)/budget')}
      >
        {t(language, 'onboardingSkipForNow')}
      </Button>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    height: 42,
    paddingHorizontal: 12,
  },
});
