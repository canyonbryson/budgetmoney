import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
};

export default function OnboardingStep({
  step,
  total,
  title,
  subtitle,
  icon = 'sparkles-outline',
  children,
}: Props) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  return (
    <ScreenWrapper edges={['top', 'bottom']}>
      <View style={[styles.container, { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }]}>
        <View style={[styles.hero, { marginBottom: spacing.lg }]}>
          <View
            style={[
              styles.stepPill,
              {
                borderRadius: borderRadius.pill,
                borderColor: colors.borderLight,
                paddingHorizontal: spacing.md,
                marginBottom: spacing.md,
              },
            ]}
          >
            <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
              Step {step} of {total}
            </ThemedText>
          </View>
          <View
            style={[
              styles.iconCircle,
              {
                borderRadius: borderRadius.pill,
                backgroundColor: colors.primaryMuted,
                marginBottom: spacing.md,
              },
            ]}
          >
            <Ionicons name={icon} size={30} color={colors.primary} />
          </View>
          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </ThemedText>
        </View>

        <View style={{ gap: spacing.md }}>
          {children}
        </View>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 8,
  },
  stepPill: {
    borderWidth: 1,
  },
  iconCircle: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
  },
});
