import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAction, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import {
  generateShoppingListForWeek as generateLocalShoppingListForWeek,
  getShoppingListForWeek as getLocalShoppingListForWeek,
  getWeekPlan as getLocalWeekPlan,
} from '@/lib/localDb';
import { dayCodeI18nKey, getOrderedWeekDays, type DayCode } from '@/lib/mealPlanWeek';

function dayLabel(day: DayCode, language: string): string {
  return t(language as any, dayCodeI18nKey(day) as any);
}

export default function MealPlanReviewScreen() {
  const params = useLocalSearchParams<{ weekStart: string; mode: string }>();
  const weekStart = params.weekStart!;

  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const [generating, setGenerating] = React.useState(false);
  const [generated, setGenerated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const plan = useQuery(
    api.mealPlans.getWeekPlan,
    owner && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, weekStart }
      : 'skip'
  );
  const localPlan = useLocalQuery(() => getLocalWeekPlan(weekStart), [weekStart], !isSignedIn);

  const shoppingList = useQuery(
    api.mealPlans.getShoppingListForWeek,
    owner && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, weekStart }
      : 'skip'
  );
  const localShoppingList = useLocalQuery(
    () => getLocalShoppingListForWeek(weekStart),
    [weekStart],
    !isSignedIn
  );

  const generateList = useAction(api.mealPlans.generateShoppingList);

  const items = (isSignedIn ? plan?.items : localPlan.data?.items) ?? [];
  const shoppingListData = isSignedIn ? shoppingList : localShoppingList.data;
  const orderedDays = React.useMemo(() => getOrderedWeekDays(weekStart), [weekStart]);

  // Group items by day
  const byDay = React.useMemo(() => {
    const map = new Map<string, any[]>();
    for (const day of orderedDays) {
      map.set(day, []);
    }
    for (const item of items) {
      const list = map.get(item.day);
      if (list) list.push(item);
    }
    return map;
  }, [items, orderedDays]);

  const onGenerate = async () => {
    if (!owner || generating) return;
    setGenerating(true);
    setError(null);
    try {
      if (isSignedIn) {
        await generateList({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
        });
      } else {
        await generateLocalShoppingListForWeek(weekStart);
        bumpRefresh();
      }
      setGenerated(true);
    } catch (err: any) {
      setError(err?.message ?? t(language, 'estimateFailed'));
    } finally {
      setGenerating(false);
    }
  };

  const onDone = () => {
    // Pop all the way back to the meals tab
    router.dismissAll();
    router.replace('/(tabs)/meals');
  };

  const onViewFullList = () => {
    router.push({
      pathname: '/(screens)/shopping-list',
      params: { weekStart },
    });
  };

  const formatQuantity = (quantity?: number | null, unit?: string | null) => {
    if (quantity === null || quantity === undefined) return '';
    const normalizedUnit = unit?.toLowerCase();
    if (!unit || normalizedUnit === 'ea' || normalizedUnit === 'x' || normalizedUnit === 'each') {
      return `${quantity}`;
    }
    return `${quantity} ${unit}`;
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'reviewPlan')}</ThemedText>

      {/* Plan summary grouped by day */}
      <View style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'planSummary')}</ThemedText>
        {orderedDays.map((day) => {
          const dayItems = byDay.get(day) ?? [];
          if (dayItems.length === 0) return null;
          return (
            <Card key={day}>
              <View style={{ gap: spacing.xs }}>
                <ThemedText type="defaultSemiBold">{dayLabel(day, language)}</ThemedText>
                {dayItems.map((item: any) => (
                  <View key={item._id} style={styles.summaryRow}>
                    <ThemedText style={[typography.caption, { color: colors.textMuted, width: 70 }]}>
                      {item.slot ? t(language, item.slot.toLowerCase() as any) : ''}
                    </ThemedText>
                    <ThemedText style={{ flex: 1 }}>{item.title}</ThemedText>
                  </View>
                ))}
              </View>
            </Card>
          );
        })}
        {items.length === 0 && (
          <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noMeals')}</ThemedText>
        )}
      </View>

      {/* Generate button */}
      {!generated && (
        <Button onPress={onGenerate} disabled={generating || items.length === 0}>
          {generating ? t(language, 'generating') : t(language, 'generateShoppingList')}
        </Button>
      )}
      {isSignedIn && !entitlements.canUseAi ? (
        <ThemedText style={{ color: colors.textMuted }}>{t(language, 'walmartEstimate')}</ThemedText>
      ) : null}
      {generating && <ActivityIndicator size="small" color={colors.primary} />}
      {error && <ThemedText style={{ color: colors.error }}>{error}</ThemedText>}

      {/* Shopping list results */}
      {(generated || !isSignedIn) && shoppingListData && shoppingListData.items.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'shoppingList')}</ThemedText>
          {shoppingListData.items.map((item: any) => (
            <ThemedView
              key={item._id}
              style={[
                styles.listRow,
                {
                  padding: spacing.sm + 2,
                  borderRadius: borderRadius.md,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <ThemedText>{item.itemName}</ThemedText>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {item.quantity !== undefined && (
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {formatQuantity(item.quantity, item.unit)}
                    </ThemedText>
                  )}
                  {item.inPantry && (
                    <ThemedText style={[typography.caption, { color: colors.success }]}>
                      {t(language, 'inPantry')}
                    </ThemedText>
                  )}
                </View>
              </View>
              {item.estimatedCost !== undefined && item.estimatedCost !== null && (
                <ThemedText>{formatMoney(item.estimatedCost)}</ThemedText>
              )}
            </ThemedView>
          ))}

          {/* Total */}
          <ThemedView
            style={[
              styles.listRow,
              {
                padding: spacing.sm + 2,
                borderRadius: borderRadius.md,
                borderColor: colors.border,
              },
            ]}
          >
            <ThemedText type="defaultSemiBold">{t(language, 'pricingEstimated')}</ThemedText>
            <ThemedText type="defaultSemiBold">
              {formatMoney(shoppingListData.totalEstimatedCost)}
            </ThemedText>
          </ThemedView>

          <Button variant="outline" onPress={onViewFullList}>
            {t(language, 'viewFullShoppingList')}
          </Button>
        </View>
      )}

      {(generated || !isSignedIn) && shoppingListData && shoppingListData.items.length === 0 && (
        <ThemedText style={{ color: colors.textMuted }}>
          {t(language, 'noShoppingList')}
        </ThemedText>
      )}

      {/* Done */}
      <Button variant="outline" onPress={onDone}>
        {t(language, 'done')}
      </Button>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listRow: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
