import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; labelKey: string }[] = [
  { icon: 'wallet-outline', labelKey: 'onboardingFeatureBudgets' },
  { icon: 'trending-up-outline', labelKey: 'onboardingFeatureTracking' },
  { icon: 'calendar-outline', labelKey: 'onboardingFeatureMealPlan' },
  { icon: 'book-outline', labelKey: 'onboardingFeatureRecipes' },
  { icon: 'calculator-outline', labelKey: 'onboardingFeaturePricePerMeal' },
];

export default function OnboardingIntroOneScreen() {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const { language } = useSettings();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.hero, { paddingHorizontal: spacing.xl }]}>
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: colors.primaryMuted,
              borderRadius: borderRadius.pill,
              marginBottom: spacing.lg,
            },
          ]}
        >
          <Ionicons name="leaf" size={40} color={colors.primary} />
        </View>

        <ThemedText type="title" style={[styles.heroTitle, { marginBottom: spacing.xs }]}>
          {t(language, 'onboardingIntro1Title')}
        </ThemedText>
        <ThemedText style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          {t(language, 'onboardingIntro1Subtitle')}
        </ThemedText>
      </View>

      <View style={[styles.features, { paddingHorizontal: spacing.xl, gap: spacing.md }]}>
        {FEATURES.map((f) => (
          <View
            key={f.labelKey}
            style={[
              styles.featureRow,
              {
                backgroundColor: colors.backgroundCard,
                borderColor: colors.borderLight,
                borderRadius: borderRadius.lg,
                padding: spacing.md,
                gap: spacing.md,
              },
            ]}
          >
            <View
              style={[
                styles.featureIcon,
                {
                  backgroundColor: colors.primaryMuted,
                  borderRadius: borderRadius.md,
                },
              ]}
            >
              <Ionicons name={f.icon} size={22} color={colors.primary} />
            </View>
            <ThemedText style={typography.bodySemiBold}>
              {t(language, f.labelKey as any)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={[styles.footer, { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }]}>
        <Button onPress={() => router.push('/(onboarding)/auth-choice')}>
          {t(language, 'continue')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    textAlign: 'center',
  },
  heroSubtitle: {
    textAlign: 'center',
    maxWidth: 280,
  },
  features: {
    flex: 1,
    justifyContent: 'center',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  featureIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 12,
  },
});
