import React from 'react';
import { router } from 'expo-router';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

export default function OnboardingRecipeScreen() {
  const { language } = useSettings();

  return (
    <OnboardingStep
      step={7}
      total={9}
      icon="book-outline"
      title={t(language, 'onboardingRecipeTitle')}
      subtitle={t(language, 'onboardingRecipeSubtitle')}
    >
      <Card>
        <ThemedText>{t(language, 'onboardingRecipeBody')}</ThemedText>
      </Card>

      <Button onPress={() => router.push('/(screens)/recipes')}>
        {t(language, 'onboardingOpenRecipes')}
      </Button>

      <Button
        variant="secondary"
        onPress={() => router.push('/(onboarding)/meal-plan')}
      >
        {t(language, 'continue')}
      </Button>
    </OnboardingStep>
  );
}
