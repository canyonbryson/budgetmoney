import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { getCurrentWeekPlan as getLocalCurrentWeekPlan } from '@/lib/localDb';
import { DAY_CODES, dayCodeFromDate, dayCodeI18nKey, getOrderedWeekDays, type DayCode } from '@/lib/mealPlanWeek';

function todayDayCode(): string {
  return dayCodeFromDate(new Date());
}

const MEAL_TYPE_ICONS: Record<string, string> = {
  recipe: 'restaurant-outline',
  leftovers: 'refresh-outline',
  eatOut: 'storefront-outline',
  skip: 'remove-circle-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

export default function MealsScreen() {
  const { language } = useSettings();
  const { owner, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const plan = useQuery(
    api.mealPlans.getCurrentWeek,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localPlan = useLocalQuery(getLocalCurrentWeekPlan, [], !isSignedIn);

  const weekData = isSignedIn ? plan : localPlan.data;
  const items = weekData?.items ?? [];
  const weekStart = weekData?.weekStart;
  const planningMode = weekData?.planningMode;
  const weekDays = React.useMemo<readonly DayCode[]>(
    () => (weekStart ? getOrderedWeekDays(weekStart) : DAY_CODES),
    [weekStart]
  );

  const today = todayDayCode();

  // Tonight's dinner
  const tonightsDinner = items.find(
    (i: any) => i.day === today && i.slot === 'Dinner'
  );

  // Active slots
  const activeSlots = React.useMemo(() => {
    if (planningMode === 'dinnerOnly') return ['Dinner'];
    if (planningMode === 'lunchDinner') return ['Lunch', 'Dinner'];
    if (planningMode === 'all') return ['Breakfast', 'Lunch', 'Dinner'];
    // Default: show whatever slots are actually used, or Dinner
    const usedSlots = new Set(items.map((i: any) => i.slot));
    if (!usedSlots.size) return ['Dinner'];
    return ['Breakfast', 'Lunch', 'Dinner'].filter((s) => usedSlots.has(s));
  }, [planningMode, items]);

  const mealTypeIcon = (item: any) => {
    const mt = item?.mealType;
    if (mt && MEAL_TYPE_ICONS[mt]) return MEAL_TYPE_ICONS[mt];
    return 'restaurant-outline';
  };

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]} edges={['top']}>
      <ThemedText type="title">{t(language, 'meals')}</ThemedText>

      {/* Tonight's Dinner Card */}
      <Card variant="accent">
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'tonightsDinner')}</ThemedText>
          {tonightsDinner ? (
            <Pressable
              onPress={() => {
                if (tonightsDinner.recipeId) {
                  router.push({
                    pathname: '/(screens)/recipe/[recipeId]',
                    params: { recipeId: tonightsDinner.recipeId },
                  });
                } else if (weekStart) {
                  router.push({
                    pathname: '/(screens)/meal-plan-setup/pick-meal',
                    params: {
                      weekStart,
                      day: today,
                      slot: 'Dinner',
                      mode: planningMode ?? 'all',
                      existingTitle: tonightsDinner.title,
                      existingItemId: tonightsDinner._id ?? (tonightsDinner as any).id ?? '',
                    },
                  });
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
            >
              <Ionicons name={mealTypeIcon(tonightsDinner) as any} size={22} color={colors.primary} />
              <ThemedText type="defaultSemiBold" style={{ flex: 1, fontSize: 17 }}>
                {tonightsDinner.title}
              </ThemedText>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <ThemedText style={{ color: colors.textMuted }}>
                {t(language, 'nothingPlanned')}
              </ThemedText>
              <Button
                size="sm"
                onPress={() =>
                  router.push({
                    pathname: '/(screens)/meal-plan-setup/pick-meal',
                    params: {
                      weekStart: weekStart ?? '',
                      day: today,
                      slot: 'Dinner',
                      mode: planningMode ?? 'dinnerOnly',
                    },
                  })
                }
              >
                {t(language, 'planDinner')}
              </Button>
            </View>
          )}
        </View>
      </Card>

      {/* This Week Compact Summary */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'thisWeek')}</ThemedText>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(screens)/meal-plan-setup')}
          >
            {t(language, 'edit')}
          </Button>
        </View>

        {weekDays.map((day) => {
          const dayItems = items.filter((i: any) => i.day === day && activeSlots.includes(i.slot));
          const summary = dayItems.length
            ? dayItems.map((i: any) => i.title).join(' / ')
            : '—';
          const isToday = day === today;

          return (
            <View
              key={day}
              style={[
                styles.weekRow,
                {
                  paddingVertical: spacing.xs + 2,
                  borderBottomWidth: day !== weekDays[weekDays.length - 1] ? 1 : 0,
                  borderBottomColor: colors.borderLight,
                  backgroundColor: isToday ? colors.primaryMuted : 'transparent',
                  borderRadius: isToday ? borderRadius.sm : 0,
                  paddingHorizontal: isToday ? spacing.xs : 0,
                },
              ]}
            >
              <ThemedText
                type={isToday ? 'defaultSemiBold' : 'default'}
                style={{ width: 36, color: isToday ? colors.primary : colors.textMuted }}
              >
                {t(language, dayCodeI18nKey(day) as any)}
              </ThemedText>
              <ThemedText numberOfLines={1} style={{ flex: 1, color: dayItems.length ? colors.text : colors.textMuted, fontSize: 13 }}>
                {summary}
              </ThemedText>
            </View>
          );
        })}
      </Card>

      {/* 2x2 Nav Grid */}
      <View style={[styles.navGrid, { gap: spacing.sm }]}>
        <NavTile
          icon="cart-outline"
          label={t(language, 'shoppingList')}
          color={colors.accent}
          bg={colors.accentMuted}
          onPress={() => router.push('/(screens)/shopping-list')}
        />
        <NavTile
          icon="book-outline"
          label={t(language, 'recipes')}
          color={colors.success}
          bg={colors.primaryMuted}
          onPress={() => router.push('/(screens)/recipes')}
        />
        <NavTile
          icon="nutrition-outline"
          label={t(language, 'pantry')}
          color={colors.warning}
          bg={colors.accentMuted}
          onPress={() => router.push('/(screens)/pantry')}
        />
        <NavTile
          icon="calendar-outline"
          label={t(language, 'mealPlanSetup')}
          color={colors.primary}
          bg={colors.primaryMuted}
          onPress={() => router.push('/(screens)/meal-plan-setup')}
        />
      </View>
    </ScreenScrollView>
  );
}

function NavTile({
  icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
  onPress: () => void;
}) {
  const { spacing, borderRadius } = useAppTheme();

  return (
    <Pressable onPress={onPress} style={[styles.navTile]}>
      <Card style={{ alignItems: 'center', gap: spacing.sm, flex: 1 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: borderRadius.md,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <ThemedText type="defaultSemiBold" style={{ fontSize: 13, textAlign: 'center' }}>
          {label}
        </ThemedText>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  navTile: {
    width: '48%',
  },
});
