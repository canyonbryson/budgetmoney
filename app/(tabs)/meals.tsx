import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import ScreenScrollView from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';

type NavCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  accentColor: string;
  accentBg: string;
  onPress: () => void;
  extra?: React.ReactNode;
};

function NavCard({ icon, title, subtitle, accentColor, accentBg, onPress, extra }: NavCardProps) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  return (
    <Pressable onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: borderRadius.md,
            backgroundColor: accentBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons name={icon} size={22} color={accentColor} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <ThemedText type="defaultSemiBold">{title}</ThemedText>
            <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{subtitle}</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
        {extra}
      </Card>
    </Pressable>
  );
}

export default function MealsScreen() {
  const { language } = useSettings();
  const { colors, spacing } = useAppTheme();

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'meals')}</ThemedText>

      <NavCard
        icon="calendar-outline"
        title={t(language, 'weeklyPlan')}
        subtitle="Plan and organize your weekly meals"
        accentColor={colors.primary}
        accentBg={colors.primaryMuted}
        onPress={() => router.push('/(screens)/meal-plan')}
      />

      <NavCard
        icon="cart-outline"
        title={t(language, 'shoppingList')}
        subtitle="Track groceries and essentials"
        accentColor={colors.accent}
        accentBg={colors.accentMuted}
        onPress={() => router.push('/(screens)/shopping-list')}
      />

      <NavCard
        icon="book-outline"
        title={t(language, 'recipes')}
        subtitle="Your saved recipes collection"
        accentColor={colors.success}
        accentBg={colors.primaryMuted}
        onPress={() => router.push('/(screens)/recipes')}
        extra={
          <View style={{ marginTop: spacing.sm }}>
            <Button variant="outline" size="sm" onPress={() => router.push('/(screens)/recipes')}>
              {t(language, 'addRecipe')}
            </Button>
          </View>
        }
      />

      <NavCard
        icon="nutrition-outline"
        title={t(language, 'pantry')}
        subtitle="Keep track of what you have"
        accentColor={colors.warning}
        accentBg={colors.accentMuted}
        onPress={() => router.push('/(screens)/pantry')}
      />
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
});
