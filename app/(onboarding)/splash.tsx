import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from 'convex/react';

import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { api } from '@/convex/_generated/api';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';

export default function OnboardingSplashScreen() {
  const { colors, spacing } = useAppTheme();
  const { language } = useSettings();
  const { owner, isReady } = useIdentity();
  const hasNavigated = React.useRef(false);

  const onboardingStatus = useQuery(
    api.devices.getOnboardingStatus,
    owner && isReady ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );

  React.useEffect(() => {
    if (!isReady || !owner || onboardingStatus === undefined || hasNavigated.current) return;
    hasNavigated.current = true;
    if (onboardingStatus.completed) {
      router.replace('/(tabs)');
      return;
    }
    router.replace('/(onboarding)/intro-1');
  }, [isReady, owner, onboardingStatus]);

  return (
    <ScreenWrapper style={styles.container}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <ThemedText type="title">GroceryBudget</ThemedText>
        <ThemedText style={{ color: colors.textSecondary }}>
          {t(language, 'onboardingSplashSubtitle')}
        </ThemedText>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
