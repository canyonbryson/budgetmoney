import React from 'react';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { api } from '@/convex/_generated/api';
import { t } from '@/i18n';
import OnboardingStep from './OnboardingStep';

export default function OnboardingBankScreen() {
  const { owner, isSignedIn, entitlements } = useIdentity();
  const { language } = useSettings();
  const accounts = useQuery(
    api.plaid.listAccounts,
    owner && isSignedIn && entitlements.canUsePlaid
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId }
      : 'skip'
  );
  const hasAccount = (accounts?.length ?? 0) > 0;

  return (
    <OnboardingStep
      step={6}
      total={9}
      icon="card-outline"
      title={t(language, 'onboardingBankTitle')}
      subtitle={t(language, 'onboardingBankSubtitle')}
    >
      <Card>
        <ThemedText>
          {isSignedIn
            ? t(language, 'onboardingBankBodySignedIn')
            : t(language, 'onboardingBankBodyGuest')}
        </ThemedText>
      </Card>

      {isSignedIn ? (
        <Button onPress={() => router.push('/(screens)/accounts')}>{t(language, 'onboardingOpenAccounts')}</Button>
      ) : (
        <Button onPress={() => router.push('/sign-in')}>{t(language, 'onboardingSignInToConnect')}</Button>
      )}

      <Button
        variant="secondary"
        onPress={() => router.push('/(onboarding)/recipe')}
      >
        {hasAccount ? t(language, 'continue') : t(language, 'onboardingSkipForNow')}
      </Button>
    </OnboardingStep>
  );
}
