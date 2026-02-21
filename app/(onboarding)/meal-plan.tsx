import React from 'react';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { api } from '@/convex/_generated/api';
import { getCurrentWeekPlan } from '@/lib/localDb';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

export default function OnboardingMealPlanScreen() {
  const { owner, isSignedIn } = useIdentity();
  const { language } = useSettings();
  const plan = useQuery(
    api.mealPlans.getCurrentWeek,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localPlan = useLocalQuery(getCurrentWeekPlan, [], !isSignedIn);
  const count = isSignedIn ? (plan?.items?.length ?? 0) : (localPlan.data?.items?.length ?? 0);

  return (
    <OnboardingStep
      step={8}
      total={9}
      icon="calendar-outline"
      title={t(language, 'onboardingMealPlanTitle')}
      subtitle={t(language, 'onboardingMealPlanSubtitle')}
    >
      <Card>
        <ThemedText>{t(language, 'onboardingMealPlanBody')}</ThemedText>
      </Card>

      <Button onPress={() => router.push('/(screens)/meal-plan-setup')}>
        {t(language, 'onboardingOpenMealSetup')}
      </Button>

      <Button
        variant="secondary"
        disabled={count < 1}
        onPress={() => router.push('/(onboarding)/finish')}
      >
        {count > 0 ? t(language, 'continue') : t(language, 'onboardingMealContinueHint')}
      </Button>
    </OnboardingStep>
  );
}
