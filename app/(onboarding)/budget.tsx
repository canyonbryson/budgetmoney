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
import { getBudgetHierarchyWithSpent } from '@/lib/localDb';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

function hasAnyBudget(items: any[]) {
  for (const item of items) {
    if ((item.amount ?? 0) > 0) return true;
    const children = item.children ?? [];
    if (children.some((child: any) => (child.amount ?? 0) > 0)) return true;
  }
  return false;
}

export default function OnboardingBudgetScreen() {
  const { owner, isSignedIn } = useIdentity();
  const { language } = useSettings();
  const fullHierarchy = useQuery(
    api.budgets.getFullHierarchy,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localHierarchy = useLocalQuery(getBudgetHierarchyWithSpent, [], !isSignedIn);

  const items = isSignedIn ? (fullHierarchy?.items ?? []) : (localHierarchy.data?.items ?? []);
  const readyToContinue = hasAnyBudget(items);

  return (
    <OnboardingStep
      step={5}
      total={9}
      icon="wallet-outline"
      title={t(language, 'onboardingBudgetTitle')}
      subtitle={t(language, 'onboardingBudgetSubtitle')}
    >
      <Card>
        <ThemedText>{t(language, 'onboardingBudgetBody')}</ThemedText>
      </Card>

      <Button
        onPress={() =>
          router.push({
            pathname: '/(screens)/budget-setup',
            params: { source: 'onboarding' },
          })
        }
      >
        {t(language, 'onboardingOpenBudgetSetup')}
      </Button>

      <Button
        variant="secondary"
        disabled={!readyToContinue}
        onPress={() => router.push('/(onboarding)/bank')}
      >
        {readyToContinue ? t(language, 'continue') : t(language, 'onboardingBudgetContinueHint')}
      </Button>
    </OnboardingStep>
  );
}
