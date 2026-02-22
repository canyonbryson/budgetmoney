import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import {
  addMealPlanItem,
  deleteMealPlanItem,
  getCurrentWeekPlan,
  getShoppingListCurrentWeek,
  listRecipes,
  updateMealPlanItem,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

export default function MealPlanScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius } = useAppTheme();
  const [draftTitle, setDraftTitle] = React.useState('');
  const [draftDay, setDraftDay] = React.useState('');
  const [draftSlot, setDraftSlot] = React.useState('');
  const [editingId, setEditingId] = React.useState<Id<'mealPlanItems'> | null>(null);
  const [draftRecipeId, setDraftRecipeId] = React.useState<Id<'recipes'> | null>(null);
  const plan = useQuery(
    api.mealPlans.getCurrentWeek,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const shoppingList = useQuery(
    api.mealPlans.getShoppingListCurrentWeek,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localPlan = useLocalQuery(getCurrentWeekPlan, [], !isSignedIn);
  const localShoppingList = useLocalQuery(getShoppingListCurrentWeek, [], !isSignedIn);
  const recipes = useQuery(
    api.recipes.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localRecipes = useLocalQuery(listRecipes, [], !isSignedIn);
  const generateList = useAction(api.mealPlans.generateShoppingList);
  const addMealItem = useMutation(api.mealPlans.addMealPlanItem);
  const updateMealItem = useMutation(api.mealPlans.updateMealPlanItem);
  const deleteMealItem = useMutation(api.mealPlans.deleteMealPlanItem);

  const onGenerate = async () => {
    if (!owner) return;
    if (!entitlements.canUseAi || !isSignedIn) return;
    await generateList({ ownerType: owner.ownerType, ownerId: owner.ownerId });
  };

  const onSaveMeal = async () => {
    if (!owner || !draftTitle.trim() || !draftDay.trim()) return;
    if (!isSignedIn) {
      if (editingId) {
        await updateMealPlanItem({
          itemId: editingId,
          title: draftTitle.trim(),
          day: draftDay.trim(),
          slot: draftSlot.trim() || null,
        });
      } else {
        await addMealPlanItem({
          title: draftTitle.trim(),
          day: draftDay.trim(),
          slot: draftSlot.trim() || null,
        });
      }
      bumpRefresh();
    } else {
      if (editingId) {
        await updateMealItem({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId: editingId,
          title: draftTitle.trim(),
          day: draftDay.trim(),
          slot: draftSlot.trim() || undefined,
          recipeId: draftRecipeId ?? undefined,
        });
      } else {
        await addMealItem({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          title: draftTitle.trim(),
          day: draftDay.trim(),
          slot: draftSlot.trim() || undefined,
          recipeId: draftRecipeId ?? undefined,
        });
      }
    }
    setDraftTitle('');
    setDraftDay('');
    setDraftSlot('');
    setDraftRecipeId(null);
    setEditingId(null);
  };

  const onEditMeal = (item: any) => {
    setDraftTitle(item.title ?? '');
    setDraftDay(item.day ?? '');
    setDraftSlot(item.slot ?? '');
    setDraftRecipeId(item.recipeId ?? null);
    setEditingId(item._id);
  };

  const onCancelEdit = () => {
    setDraftTitle('');
    setDraftDay('');
    setDraftSlot('');
    setDraftRecipeId(null);
    setEditingId(null);
  };

  const onDeleteMeal = async (itemId: Id<'mealPlanItems'>) => {
    if (!owner) return;
    if (!isSignedIn) {
      await deleteMealPlanItem(itemId);
      bumpRefresh();
    } else {
      await deleteMealItem({ ownerType: owner.ownerType, ownerId: owner.ownerId, itemId });
    }
    if (editingId === itemId) {
      setEditingId(null);
      setDraftTitle('');
      setDraftDay('');
      setDraftSlot('');
      setDraftRecipeId(null);
    }
  };

  const formatQuantity = (quantity?: number | null, unit?: string | null) => {
    if (quantity === null || quantity === undefined) return '';
    const normalizedUnit = unit?.toLowerCase();
    if (!unit || normalizedUnit === 'ea' || normalizedUnit === 'x' || normalizedUnit === 'each') {
      return `${quantity}`;
    }
    return `${quantity} ${unit}`;
  };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return '';
    return formatMoney(value);
  };

  const getPriceSourceLabel = (item: any) => {
    if (item.priceSource === 'walmart' || item.priceSource === 'online' || item.priceSource === 'winco') {
      return t(language, 'walmartEstimate');
    }
    if (item.priceSource === 'ai') {
      const lowConfidence =
        typeof item.estimateConfidence === 'number' && item.estimateConfidence < 0.5;
      return lowConfidence
        ? `${t(language, 'aiEstimate')} (${t(language, 'lowConfidence')})`
        : t(language, 'aiEstimate');
    }
    return null;
  };

  const dayOptions = [
    { value: 'Mon', label: t(language, 'mondayShort') },
    { value: 'Tue', label: t(language, 'tuesdayShort') },
    { value: 'Wed', label: t(language, 'wednesdayShort') },
    { value: 'Thu', label: t(language, 'thursdayShort') },
    { value: 'Fri', label: t(language, 'fridayShort') },
    { value: 'Sat', label: t(language, 'saturdayShort') },
    { value: 'Sun', label: t(language, 'sundayShort') },
  ];

  const slotOptions = [
    { value: 'Breakfast', label: t(language, 'breakfast') },
    { value: 'Lunch', label: t(language, 'lunch') },
    { value: 'Dinner', label: t(language, 'dinner') },
    { value: 'Snack', label: t(language, 'snack') },
  ];

  const recipeOptions = (isSignedIn ? recipes : localRecipes.data) ?? [];

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}>
      <ThemedText type="title">{t(language, 'weeklyPlan')}</ThemedText>

      <ThemedView style={[styles.inputRow, { gap: spacing.sm }]}>
        <TextInput
          style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={draftTitle}
          onChangeText={(val) => {
            setDraftTitle(val);
            if (draftRecipeId) {
              setDraftRecipeId(null);
            }
          }}
          placeholder={t(language, 'mealTitle')}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={draftDay}
          onChangeText={setDraftDay}
          placeholder={t(language, 'day')}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={draftSlot}
          onChangeText={setDraftSlot}
          placeholder={t(language, 'slot')}
          placeholderTextColor={colors.textMuted}
        />
        <Button onPress={onSaveMeal}>
          {editingId ? t(language, 'save') : t(language, 'addMealPlan')}
        </Button>
        {editingId ? <Button onPress={onCancelEdit}>{t(language, 'cancel')}</Button> : null}
      </ThemedView>

      <ThemedView style={{ gap: spacing.xs }}>
        <ThemedText type="subtitle">{t(language, 'day')}</ThemedText>
        <View style={[styles.pillRow, { gap: spacing.xs }]}>
          {dayOptions.map((option) => {
            const isActive = draftDay === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setDraftDay(option.value)}
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.border },
                  isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
              >
                <ThemedText>{option.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      </ThemedView>

      <ThemedView style={{ gap: spacing.xs }}>
        <ThemedText type="subtitle">{t(language, 'slot')}</ThemedText>
        <View style={[styles.pillRow, { gap: spacing.xs }]}>
          {slotOptions.map((option) => {
            const isActive = draftSlot === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setDraftSlot(option.value)}
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.border },
                  isActive && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                ]}
              >
                <ThemedText>{option.label}</ThemedText>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setDraftSlot('')}
            style={[styles.pill, { borderRadius: borderRadius.pill, borderColor: colors.border }]}
          >
            <ThemedText>{t(language, 'clearSlot')}</ThemedText>
          </Pressable>
        </View>
      </ThemedView>

      {recipeOptions.length ? (
        <ThemedView style={{ gap: spacing.xs }}>
          <ThemedText type="subtitle">{t(language, 'recipes')}</ThemedText>
          <View style={[styles.pillRow, { gap: spacing.xs }]}>
            {recipeOptions.slice(0, 10).map((recipe: any) => (
              <Pressable
                key={recipe._id ?? recipe.id}
                onPress={() => {
                  setDraftTitle(recipe.name ?? recipe.title ?? '');
                  setDraftRecipeId(isSignedIn ? recipe._id : null);
                }}
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.border },
                  draftRecipeId === recipe._id && { backgroundColor: colors.primaryMuted },
                ]}
              >
                <ThemedText>{recipe.name ?? recipe.title}</ThemedText>
              </Pressable>
            ))}
          </View>
        </ThemedView>
      ) : null}

      <Button onPress={onGenerate} disabled={!entitlements.canUseAi}>
        {t(language, 'shoppingList')}
      </Button>

      {isSignedIn ? !plan : !localPlan.data ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (isSignedIn ? plan : localPlan.data)!.items.length ? (
        <ThemedView style={{ gap: spacing.sm }}>
          {(isSignedIn ? plan : localPlan.data)!.items.map((item: any) => (
            <ThemedView key={item._id} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
              <ThemedView style={{ gap: 4, flex: 1 }}>
                <ThemedText>{item.title}</ThemedText>
                <ThemedText>
                  {item.day}
                  {item.slot ? ` • ${item.slot}` : ''}
                </ThemedText>
              </ThemedView>
              <ThemedView style={[styles.rowActions, { gap: spacing.sm }]}>
                <Button onPress={() => onEditMeal(item)}>{t(language, 'edit')}</Button>
                <Button onPress={() => onDeleteMeal(item._id)}>{t(language, 'delete')}</Button>
              </ThemedView>
            </ThemedView>
          ))}
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noMeals')}</ThemedText>
      )}

      <ThemedView style={styles.sectionHeader}>
        <ThemedText type="subtitle">{t(language, 'shoppingList')}</ThemedText>
        <Button onPress={() => router.push('/(screens)/shopping-list')}>
          {t(language, 'viewAll')}
        </Button>
      </ThemedView>
      {isSignedIn ? !shoppingList : !localShoppingList.data ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (isSignedIn ? shoppingList : localShoppingList.data)!.items.length ? (
        <ThemedView style={{ gap: spacing.sm }}>
          {(isSignedIn ? shoppingList : localShoppingList.data)!.items.map((item: any) => (
              <ThemedView key={item._id} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                <ThemedView style={{ gap: 4 }}>
                  <ThemedText>{item.itemName}</ThemedText>
                  {item.quantity !== undefined ? (
                    <ThemedText type="defaultSemiBold">
                      {formatQuantity(item.quantity, item.unit)}
                    </ThemedText>
                  ) : null}
                  {getPriceSourceLabel(item) ? (
                    <ThemedText style={{ color: colors.textMuted, fontSize: 12 }}>
                      {getPriceSourceLabel(item)}
                    </ThemedText>
                  ) : null}
                </ThemedView>
                <ThemedText>{formatCurrency(item.estimatedCost)}</ThemedText>
              </ThemedView>
            ))}
          <ThemedView style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.border }]}>
            <ThemedText type="defaultSemiBold">{t(language, 'pricingEstimated')}</ThemedText>
            <ThemedText type="defaultSemiBold">
              {formatCurrency((isSignedIn ? shoppingList : localShoppingList.data)!.totalEstimatedCost)}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noShoppingList')}</ThemedText>
      )}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowActions: {
    flexDirection: 'row',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  inputCompact: {
    minWidth: 90,
    flex: 0.4,
  },
});
