import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

export default function OnboardingAuthChoiceScreen() {
  const { isSignedIn } = useIdentity();
  const { language } = useSettings();
  const { spacing, colors } = useAppTheme();

  return (
    <OnboardingStep
      step={3}
      total={9}
      icon="person-circle-outline"
      title={t(language, 'onboardingAuthTitle')}
      subtitle={t(language, 'onboardingAuthSubtitle')}
    >
      <Card>
        <ThemedText style={{ color: colors.textSecondary }}>
          {isSignedIn
            ? t(language, 'onboardingAuthSignedIn')
            : t(language, 'onboardingAuthGuest')}
        </ThemedText>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {!isSignedIn ? (
          <Button
            onPress={() =>
              router.push({
                pathname: '/sign-in',
                params: { returnTo: '/(onboarding)/budget' },
              })
            }
          >
            {t(language, 'signIn')}
          </Button>
        ) : null}

        <Button
          variant={isSignedIn ? 'primary' : 'secondary'}
          onPress={() => router.push('/(onboarding)/budget')}
        >
          {isSignedIn ? t(language, 'continue') : t(language, 'onboardingContinueGuest')}
        </Button>
      </View>
    </OnboardingStep>
  );
}
