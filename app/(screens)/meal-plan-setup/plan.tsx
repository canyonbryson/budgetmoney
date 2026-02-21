import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';

import ScreenWrapper from '@/components/ScreenWrapper';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import {
  clearWeekMealPlanItems as clearLocalWeekItems,
  deleteMealPlanItem as deleteLocalMealPlanItem,
  getWeekPlan as getLocalWeekPlan,
} from '@/lib/localDb';
import { getOrderedWeekDays, type DayCode } from '@/lib/mealPlanWeek';

type PlanningMode = 'all' | 'lunchDinner' | 'dinnerOnly';

function slotsForMode(mode: PlanningMode): string[] {
  if (mode === 'all') return ['Breakfast', 'Lunch', 'Dinner'];
  if (mode === 'lunchDinner') return ['Lunch', 'Dinner'];
  return ['Dinner'];
}

function slotLabel(slot: string, language: string): string {
  const key = slot.toLowerCase() as 'breakfast' | 'lunch' | 'dinner';
  return t(language as any, key);
}

function dayDateLabel(day: DayCode, weekStart: string, orderedDays: DayCode[]): string {
  const ws = new Date(weekStart + 'T00:00:00');
  const dayIndex = orderedDays.indexOf(day);
  const d = new Date(ws);
  d.setDate(d.getDate() + dayIndex);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const MEAL_TYPE_ICONS: Record<string, string> = {
  recipe: 'restaurant-outline',
  leftovers: 'refresh-outline',
  eatOut: 'storefront-outline',
  skip: 'remove-circle-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

export default function MealPlanGridScreen() {
  const params = useLocalSearchParams<{
    weekStart: string;
    mode: PlanningMode;
    fresh?: string;
  }>();
  const weekStart = params.weekStart!;
  const mode = (params.mode ?? 'all') as PlanningMode;
  const shouldClear = params.fresh === '1';

  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const plan = useQuery(
    api.mealPlans.getWeekPlan,
    owner && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, weekStart }
      : 'skip'
  );
  const localPlan = useLocalQuery(
    () => getLocalWeekPlan(weekStart),
    [weekStart],
    !isSignedIn
  );

  const clearItems = useMutation(api.mealPlans.clearWeekMealPlanItems);
  const deleteItem = useMutation(api.mealPlans.deleteMealPlanItem);
  const [cleared, setCleared] = React.useState(false);

  React.useEffect(() => {
    const hasData = isSignedIn ? Boolean(plan) : Boolean(localPlan.data);
    if (shouldClear && !cleared && owner && hasData) {
      setCleared(true);
      if (isSignedIn) {
        clearItems({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
        });
      } else {
        clearLocalWeekItems(weekStart).then(() => bumpRefresh());
      }
    }
  }, [shouldClear, cleared, owner, isSignedIn, plan, localPlan.data, weekStart, clearItems, bumpRefresh]);

  const slots = slotsForMode(mode);
  const orderedDays = React.useMemo(() => getOrderedWeekDays(weekStart), [weekStart]);
  const items = (isSignedIn ? plan?.items : localPlan.data?.items) ?? [];

  const getItemForCell = (day: string, slot: string) =>
    items.find((i: any) => i.day === day && i.slot === slot);

  const filledCount = items.filter((i: any) =>
    orderedDays.includes(i.day as DayCode) && slots.includes(i.slot ?? '')
  ).length;
  const totalSlots = orderedDays.length * slots.length;

  const onCellPress = (day: string, slot: string) => {
    const existing = getItemForCell(day, slot);
    router.push({
      pathname: '/(screens)/meal-plan-setup/pick-meal',
      params: {
        weekStart,
        day,
        slot,
        mode,
        existingTitle: existing?.title ?? '',
        existingItemId: existing?._id ?? existing?.id ?? '',
        existingMealType: (existing as any)?.mealType ?? '',
      },
    });
  };

  const onRemoveItem = async (itemId: string) => {
    if (!owner) return;
    if (isSignedIn) {
      await deleteItem({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        itemId: itemId as any,
      });
    } else {
      await deleteLocalMealPlanItem(itemId);
      bumpRefresh();
    }
  };

  const onReview = () => {
    router.push({
      pathname: '/(screens)/meal-plan-setup/review',
      params: { weekStart, mode },
    });
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper style={{ flex: 1 }}>
      {/* Progress header */}
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm }}>
        <ThemedText type="subtitle">
          {t(language, 'mealsPlanned')
            .replace('{count}', String(filledCount))
            .replace('{total}', String(totalSlots))}
        </ThemedText>
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: colors.borderLight, borderRadius: borderRadius.pill, height: 6 },
          ]}
        >
          <View
            style={{
              width: totalSlots > 0 ? `${(filledCount / totalSlots) * 100}%` : '0%',
              height: '100%',
              backgroundColor: colors.primary,
              borderRadius: borderRadius.pill,
            }}
          />
        </View>
      </View>

      {/* Vertical day-card list */}
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {orderedDays.map((day) => (
          <Card key={day}>
            <ThemedText type="defaultSemiBold" style={{ marginBottom: spacing.sm }}>
              {dayDateLabel(day, weekStart, orderedDays)}
            </ThemedText>

            {slots.map((slot) => {
              const item = getItemForCell(day, slot);
              const mealType = (item as any)?.mealType;
              const iconName = mealType && MEAL_TYPE_ICONS[mealType]
                ? MEAL_TYPE_ICONS[mealType]
                : item ? 'restaurant-outline' : undefined;

              return (
                <Pressable
                  key={`${day}-${slot}`}
                  onPress={() => onCellPress(day, slot)}
                  style={[
                    styles.slotRow,
                    {
                      paddingVertical: spacing.sm,
                      borderBottomWidth: slot !== slots[slots.length - 1] ? 1 : 0,
                      borderBottomColor: colors.borderLight,
                    },
                  ]}
                >
                  {/* Slot label */}
                  <View style={[styles.slotLabel, { minWidth: 80 }]}>
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {slotLabel(slot, language)}
                    </ThemedText>
                  </View>

                  {/* Meal content */}
                  <View style={styles.slotContent}>
                    {item ? (
                      <View style={styles.filledSlot}>
                        {iconName && (
                          <Ionicons
                            name={iconName as any}
                            size={16}
                            color={colors.primary}
                            style={{ marginRight: spacing.xs }}
                          />
                        )}
                        <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 14 }}>
                          {item.title}
                        </ThemedText>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation?.();
                            onRemoveItem(item._id ?? (item as any).id);
                          }}
                          hitSlop={8}
                        >
                          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.emptySlot}>
                        <Ionicons name="add" size={18} color={colors.textMuted} />
                        <ThemedText style={{ color: colors.textMuted, fontSize: 13, marginLeft: 4 }}>
                          {t(language, 'addMeal')}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ))}
      </ScrollView>

      {/* Bottom bar */}
      <View
        style={[
          styles.bottomBar,
          {
            padding: spacing.lg,
            gap: spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Button variant="outline" onPress={() => router.back()} style={{ flex: 1 }}>
          {t(language, 'save')}
        </Button>
        <Button onPress={onReview} style={{ flex: 1 }}>
          {t(language, 'generateShoppingList')}
        </Button>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    overflow: 'hidden',
    marginTop: 6,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotLabel: {
    flexShrink: 0,
  },
  slotContent: {
    flex: 1,
  },
  filledSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emptySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.6,
  },
  bottomBar: {
    flexDirection: 'row',
  },
});
