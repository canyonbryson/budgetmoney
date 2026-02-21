import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from 'convex/react';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/convex/_generated/api';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

export default function OnboardingFinishScreen() {
  const { owner } = useIdentity();
  const { language } = useSettings();
  const { colors, spacing } = useAppTheme();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const markComplete = useMutation(api.devices.markOnboardingComplete);

  const onFinish = async () => {
    if (!owner || saving) return;
    setSaving(true);
    setError(null);
    try {
      await markComplete({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message ?? t(language, 'onboardingFinishError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingStep
      step={8}
      total={9}
      icon="checkmark-done-circle-outline"
      title={t(language, 'onboardingFinishTitle')}
      subtitle={t(language, 'onboardingFinishSubtitle')}
    >
      <Card>
        <ThemedText>{t(language, 'onboardingFinishBody')}</ThemedText>
      </Card>

      <Button onPress={onFinish} disabled={saving}>
        {saving ? t(language, 'onboardingFinishing') : t(language, 'onboardingFinishButton')}
      </Button>

      {saving ? (
        <View style={{ marginTop: spacing.sm }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
      {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
    </OnboardingStep>
  );
}
