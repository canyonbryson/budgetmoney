import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
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
import { getWeekPlan as getLocalWeekPlan, setMealPlanMode as setLocalMealPlanMode } from '@/lib/localDb';
import {
  DAY_CODES,
  dayCodeI18nKey,
  formatIsoDate,
  getWeekStartForDay,
  type DayCode,
} from '@/lib/mealPlanWeek';

type PlanningMode = 'all' | 'lunchDinner' | 'dinnerOnly';

function formatWeekRange(weekStart: Date) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function slotsForMode(mode: PlanningMode): string[] {
  if (mode === 'all') return ['Breakfast', 'Lunch', 'Dinner'];
  if (mode === 'lunchDinner') return ['Lunch', 'Dinner'];
  return ['Dinner'];
}

const MODE_OPTIONS: { value: PlanningMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'all', icon: 'sunny-outline' },
  { value: 'lunchDinner', icon: 'partly-sunny-outline' },
  { value: 'dinnerOnly', icon: 'moon-outline' },
];

export default function MealPlanSetupScreen() {
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [startDay, setStartDay] = React.useState<DayCode>('Mon');
  const [mode, setMode] = React.useState<PlanningMode>('all');

  const weekStartDate = React.useMemo(
    () => getWeekStartForDay(new Date(), startDay, weekOffset),
    [startDay, weekOffset]
  );
  const weekStartStr = formatIsoDate(weekStartDate);

  const plan = useQuery(
    api.mealPlans.getWeekPlan,
    owner && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, weekStart: weekStartStr }
      : 'skip'
  );
  const localPlan = useLocalQuery(
    () => getLocalWeekPlan(weekStartStr),
    [weekStartStr],
    !isSignedIn
  );
  const batchAddItems = useMutation(api.mealPlans.batchAddMealPlanItems);

  // Sync mode from existing plan when data arrives
  React.useEffect(() => {
    const source = isSignedIn ? plan : localPlan.data;
    if (source?.planningMode) {
      setMode(source.planningMode as PlanningMode);
    }
  }, [plan, localPlan.data, isSignedIn]);

  const existingCount = (isSignedIn ? plan?.items?.length : localPlan.data?.items?.length) ?? 0;
  const totalSlots = 7 * slotsForMode(mode).length;

  const modeLabel = (m: PlanningMode) => {
    if (m === 'all') return t(language, 'allMeals');
    if (m === 'lunchDinner') return t(language, 'lunchAndDinner');
    return t(language, 'dinnersOnly');
  };

  const modeDesc = (m: PlanningMode) => {
    if (m === 'all') return t(language, 'allMealsDesc');
    if (m === 'lunchDinner') return t(language, 'lunchAndDinnerDesc');
    return t(language, 'dinnersOnlyDesc');
  };

  const onStartPlanning = async () => {
    if (!owner) return;
    if (!isSignedIn) {
      await setLocalMealPlanMode(weekStartStr, mode);
      bumpRefresh();
    } else {
      await batchAddItems({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart: weekStartStr,
        planningMode: mode,
        items: [],
      });
    }
    router.push({
      pathname: '/(screens)/meal-plan-setup/plan',
      params: { weekStart: weekStartStr, mode },
    });
  };

  const onStartFresh = async () => {
    if (!owner) return;
    if (!isSignedIn) {
      await setLocalMealPlanMode(weekStartStr, mode);
      bumpRefresh();
    } else {
      await batchAddItems({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        weekStart: weekStartStr,
        planningMode: mode,
        items: [],
      });
    }
    router.push({
      pathname: '/(screens)/meal-plan-setup/plan',
      params: { weekStart: weekStartStr, mode, fresh: '1' },
    });
  };

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'mealPlanSetup')}</ThemedText>

      {/* Week selector */}
      <Card>
        <View style={[styles.weekSelector, { gap: spacing.md }]}>
          <Pressable onPress={() => setWeekOffset((o) => o - 1)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </Pressable>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <ThemedText type="defaultSemiBold">{t(language, 'weekOf')}</ThemedText>
            <ThemedText style={typography.body}>{formatWeekRange(weekStartDate)}</ThemedText>
          </View>
          <Pressable onPress={() => setWeekOffset((o) => o + 1)} hitSlop={12}>
            <Ionicons name="chevron-forward" size={24} color={colors.primary} />
          </Pressable>
        </View>
      </Card>

      {/* Week start day selector */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="defaultSemiBold">{t(language, 'weekStartsOn')}</ThemedText>
          <View style={[styles.dayPicker, { gap: spacing.xs }]}>
            {DAY_CODES.map((day) => {
              const active = day === startDay;
              return (
                <Pressable
                  key={day}
                  onPress={() => setStartDay(day)}
                  style={[
                    styles.dayChip,
                    {
                      borderRadius: borderRadius.pill,
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.primaryMuted : colors.background,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                    },
                  ]}
                >
                  <ThemedText
                    type={active ? 'defaultSemiBold' : 'default'}
                    style={active ? { color: colors.primary } : undefined}
                  >
                    {t(language, dayCodeI18nKey(day))}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Card>

      {/* Planning mode picker */}
      <View style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'planningMode')}</ThemedText>
        {MODE_OPTIONS.map((opt) => {
          const isActive = mode === opt.value;
          return (
            <Pressable key={opt.value} onPress={() => setMode(opt.value)}>
              <Card variant={isActive ? 'accent' : 'default'}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: borderRadius.md,
                      backgroundColor: isActive ? colors.primaryMuted : colors.background,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={22}
                      color={isActive ? colors.primary : colors.textMuted}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText type="defaultSemiBold">{modeLabel(opt.value)}</ThemedText>
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {modeDesc(opt.value)}
                    </ThemedText>
                  </View>
                  {isActive && (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  )}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      {/* Existing plan summary */}
      {existingCount > 0 && (
        <Card variant="muted">
          <View style={{ gap: spacing.sm }}>
            <ThemedText type="defaultSemiBold">
              {t(language, 'mealsPlanned')
                .replace('{count}', String(existingCount))
                .replace('{total}', String(totalSlots))}
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button onPress={onStartPlanning} style={{ flex: 1 }}>
                {t(language, 'continuePlanning')}
              </Button>
              <Button variant="outline" onPress={onStartFresh} style={{ flex: 1 }}>
                {t(language, 'startFresh')}
              </Button>
            </View>
          </View>
        </Card>
      )}

      {/* Start button */}
      {existingCount === 0 && (
        <Button onPress={onStartPlanning}>{t(language, 'startPlanning')}</Button>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayChip: {
    borderWidth: 1,
  },
});
