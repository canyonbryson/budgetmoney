import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
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
  addMealPlanItem as addLocalMealItem,
  createRecipe as createLocalRecipe,
  deleteMealPlanItem as deleteLocalMealItem,
  listRecipes as listLocalRecipes,
  updateMealPlanItem as updateLocalMealItem,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';
import { dayCodeI18nKey, type DayCode } from '@/lib/mealPlanWeek';

type Tab = 'saved' | 'new' | 'quick';

type MealType = 'recipe' | 'leftovers' | 'eatOut' | 'skip' | 'other';

const QUICK_OPTIONS: { key: MealType; icon: string; labelKey: string }[] = [
  { key: 'leftovers', icon: 'refresh-outline', labelKey: 'leftovers' },
  { key: 'eatOut', icon: 'storefront-outline', labelKey: 'eatingOut' },
  { key: 'skip', icon: 'remove-circle-outline', labelKey: 'skipMeal' },
  { key: 'other', icon: 'ellipsis-horizontal-circle-outline', labelKey: 'otherMeal' },
];

export default function PickMealScreen() {
  const params = useLocalSearchParams<{
    weekStart: string;
    day: string;
    slot: string;
    mode: string;
    existingTitle?: string;
    existingItemId?: string;
    existingMealType?: string;
  }>();
  const { weekStart, day, slot, mode, existingTitle, existingItemId, existingMealType } = params;

  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const [tab, setTab] = React.useState<Tab>('saved');
  const [search, setSearch] = React.useState('');
  const [activeTag, setActiveTag] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // New meal form state
  const [newTitle, setNewTitle] = React.useState('');
  const [newSourceUrl, setNewSourceUrl] = React.useState('');
  const [newServings, setNewServings] = React.useState('');
  const [newNotes, setNewNotes] = React.useState('');
  const [saveAsRecipe, setSaveAsRecipe] = React.useState(true);

  // Quick options custom text
  const [otherText, setOtherText] = React.useState('');

  const recipes = useQuery(
    api.recipes.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localRecipes = useLocalQuery(listLocalRecipes, [], !isSignedIn);

  const addItem = useMutation(api.mealPlans.addMealPlanItem);
  const updateItem = useMutation(api.mealPlans.updateMealPlanItem);
  const deleteItem = useMutation(api.mealPlans.deleteMealPlanItem);
  const createRecipe = useMutation(api.recipes.createInternal);

  const filteredRecipes = React.useMemo(() => {
    const source = isSignedIn ? recipes : localRecipes.data;
    if (!source) return [];
    const query = search.trim().toLowerCase();
    return source.filter((r: any) => {
      const name = (r.name ?? r.title ?? '').toLowerCase();
      const notes = (r.notes ?? '').toLowerCase();
      const tags = (Array.isArray(r.tags) ? r.tags : []).map((tag: string) => tag.toLowerCase());
      if (query && !`${name} ${notes} ${tags.join(' ')}`.includes(query)) return false;
      if (activeTag && !tags.includes(activeTag.toLowerCase())) return false;
      return true;
    });
  }, [recipes, localRecipes.data, search, isSignedIn, activeTag]);

  const availableTags = React.useMemo(() => {
    const source = isSignedIn ? recipes ?? [] : localRecipes.data ?? [];
    return Array.from(
      new Set(
        source.flatMap((recipe: any) =>
          Array.isArray(recipe.tags) ? recipe.tags.filter((tag: string) => tag.trim().length) : []
        )
      )
    );
  }, [isSignedIn, recipes, localRecipes.data]);

  // --- Handlers ---

  const saveMealPlanItem = async (opts: {
    title: string;
    recipeId?: string;
    mealType?: MealType;
  }) => {
    if (!owner) return;
    if (existingItemId) {
      if (isSignedIn) {
        await updateItem({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId: existingItemId as Id<'mealPlanItems'>,
          title: opts.title,
          day: day!,
          slot,
          recipeId: opts.recipeId as Id<'recipes'> | undefined,
          mealType: opts.mealType,
        });
      } else {
        await updateLocalMealItem({
          itemId: existingItemId,
          title: opts.title,
          day: day!,
          slot,
          recipeId: opts.recipeId,
          mealType: opts.mealType,
        });
        bumpRefresh();
      }
    } else {
      if (isSignedIn) {
        await addItem({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
          title: opts.title,
          day: day!,
          slot,
          recipeId: opts.recipeId as Id<'recipes'> | undefined,
          mealType: opts.mealType,
        });
      } else {
        await addLocalMealItem({
          weekStart,
          title: opts.title,
          day: day!,
          slot,
          recipeId: opts.recipeId,
          mealType: opts.mealType,
        });
        bumpRefresh();
      }
    }
  };

  const onSelectRecipe = async (recipe: any) => {
    if (!owner || saving) return;
    setSaving(true);
    try {
      await saveMealPlanItem({
        title: recipe.name ?? recipe.title,
        recipeId: recipe._id ?? recipe.id,
        mealType: 'recipe',
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onAddNewMeal = async () => {
    if (!owner || !newTitle.trim() || saving) return;
    setSaving(true);
    try {
      let recipeId: string | undefined;
      const mealType: MealType = saveAsRecipe ? 'recipe' : 'other';

      if (saveAsRecipe) {
        // Create recipe first
        if (isSignedIn) {
          recipeId = await createRecipe({
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            name: newTitle.trim(),
            instructions: '',
            sourceUrl: newSourceUrl.trim() || undefined,
            servings: newServings ? Number(newServings) : undefined,
            notes: newNotes.trim() || undefined,
            tags: [],
          });
        } else {
          recipeId = await createLocalRecipe({
            name: newTitle.trim(),
            instructions: '',
            sourceUrl: newSourceUrl.trim() || null,
            servings: newServings ? Number(newServings) : null,
            notes: newNotes.trim() || null,
            tags: [],
          });
          bumpRefresh();
        }
      }

      await saveMealPlanItem({
        title: newTitle.trim(),
        recipeId,
        mealType,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onQuickOption = async (option: MealType) => {
    if (!owner || saving) return;
    const labelMap: Record<string, string> = {
      leftovers: t(language, 'leftovers'),
      eatOut: t(language, 'eatingOut'),
      skip: t(language, 'skipMeal'),
    };

    let title = labelMap[option] ?? '';
    if (option === 'other') {
      title = otherText.trim();
      if (!title) return;
    }

    setSaving(true);
    try {
      await saveMealPlanItem({ title, mealType: option });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onRemoveExisting = async () => {
    if (!owner || !existingItemId || saving) return;
    setSaving(true);
    try {
      if (isSignedIn) {
        await deleteItem({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId: existingItemId as Id<'mealPlanItems'>,
        });
      } else {
        await deleteLocalMealItem(existingItemId);
        bumpRefresh();
      }
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const slotLabel = slot
    ? t(language, slot.toLowerCase() as 'breakfast' | 'lunch' | 'dinner')
    : '';
  const dayStr = day ? t(language, dayCodeI18nKey(day as DayCode) as any) : '';

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'saved', label: t(language, 'savedMeals') },
    { key: 'new', label: t(language, 'newMeal') },
    { key: 'quick', label: t(language, 'quickOptions') },
  ];

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}>
      <ThemedText type="title">{t(language, 'pickMeal')}</ThemedText>
      <ThemedText style={{ color: colors.textMuted }}>
        {dayStr} · {slotLabel}
      </ThemedText>

      {/* Existing meal banner */}
      {existingTitle ? (
        <Card variant="muted">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="restaurant-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText type="defaultSemiBold">{existingTitle}</ThemedText>
            </View>
            <Button variant="ghost" size="sm" onPress={onRemoveExisting}>
              {t(language, 'removeMeal')}
            </Button>
          </View>
        </Card>
      ) : null}

      {/* Tab switcher */}
      <View style={[styles.tabRow, { gap: spacing.sm }]}>
        {tabs.map((option) => {
          const isActive = tab === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setTab(option.key)}
              style={[
                styles.tab,
                {
                  borderRadius: borderRadius.pill,
                  borderColor: isActive ? colors.primary : colors.border,
                  backgroundColor: isActive ? colors.primaryMuted : 'transparent',
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                },
              ]}
            >
              <ThemedText
                type={isActive ? 'defaultSemiBold' : 'default'}
                style={isActive ? { color: colors.primary } : undefined}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* === Saved Recipes Tab === */}
      {tab === 'saved' && (
        <View style={{ gap: spacing.md }}>
          <TextInput
            style={[
              styles.input,
              {
                borderRadius: borderRadius.sm,
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.background,
              },
            ]}
            value={search}
            onChangeText={setSearch}
            placeholder={t(language, 'searchRecipes')}
            placeholderTextColor={colors.textMuted}
          />
          {availableTags.length ? (
            <View style={[styles.tabRow, { gap: spacing.xs }]}>
              {availableTags.map((tag) => {
                const active = activeTag === tag;
                return (
                  <Pressable
                    key={tag}
                    onPress={() => setActiveTag((prev) => (prev === tag ? null : tag))}
                    style={[
                      styles.tab,
                      {
                        borderRadius: borderRadius.pill,
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primaryMuted : 'transparent',
                        paddingHorizontal: spacing.sm,
                        paddingVertical: spacing.xs,
                      },
                    ]}
                  >
                    <ThemedText style={active ? { color: colors.primary } : undefined}>{tag}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {(isSignedIn ? !recipes : !localRecipes.data) ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : filteredRecipes.length === 0 ? (
            <ThemedText style={{ color: colors.textMuted }}>
              {t(language, 'noRecipesFound')}
            </ThemedText>
          ) : (
            filteredRecipes.map((recipe: any) => (
              <Card key={recipe._id ?? recipe.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: borderRadius.md,
                      backgroundColor: colors.primaryMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="book-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <ThemedText type="defaultSemiBold">{recipe.name ?? recipe.title}</ThemedText>
                    {recipe.servings ? (
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {recipe.servings} {t(language, 'servings').toLowerCase()}
                      </ThemedText>
                    ) : null}
                    {Array.isArray(recipe.tags) && recipe.tags.length ? (
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {recipe.tags.slice(0, 3).join(' • ')}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <Button
                    size="sm"
                    variant="outline"
                    style={{ flex: 1 }}
                    onPress={() =>
                      router.push({
                        pathname: '/(screens)/recipe/[recipeId]',
                        params: { recipeId: recipe._id ?? recipe.id },
                      })
                    }
                  >
                    {t(language, 'recipeDetails')}
                  </Button>
                  <Button size="sm" style={{ flex: 1 }} disabled={saving} onPress={() => onSelectRecipe(recipe)}>
                    {t(language, 'addMeal')}
                  </Button>
                </View>
              </Card>
            ))
          )}
        </View>
      )}

      {/* === New Meal Tab === */}
      {tab === 'new' && (
        <View style={{ gap: spacing.md }}>
          {/* Meal name */}
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'mealName')} *</ThemedText>
            <TextInput
              style={[styles.input, inputStyle(colors, borderRadius)]}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder={t(language, 'mealName')}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
          </View>

          {/* Source URL */}
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'sourceUrl')}</ThemedText>
            <TextInput
              style={[styles.input, inputStyle(colors, borderRadius)]}
              value={newSourceUrl}
              onChangeText={setNewSourceUrl}
              placeholder="https://..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* Servings */}
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'servings')}</ThemedText>
            <TextInput
              style={[styles.input, inputStyle(colors, borderRadius)]}
              value={newServings}
              onChangeText={setNewServings}
              placeholder="4"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          {/* Notes */}
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'notes')}</ThemedText>
            <TextInput
              style={[
                styles.input,
                inputStyle(colors, borderRadius),
                { height: 80, textAlignVertical: 'top', paddingTop: 10 },
              ]}
              value={newNotes}
              onChangeText={setNewNotes}
              placeholder={t(language, 'notes')}
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          {/* Save as recipe toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <ThemedText>{t(language, 'saveAsRecipe')}</ThemedText>
            <Switch value={saveAsRecipe} onValueChange={setSaveAsRecipe} />
          </View>

          <Button onPress={onAddNewMeal} disabled={!newTitle.trim() || saving}>
            {saving ? t(language, 'generating') : t(language, 'addMeal')}
          </Button>
        </View>
      )}

      {/* === Quick Options Tab === */}
      {tab === 'quick' && (
        <View style={{ gap: spacing.md }}>
          {QUICK_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => opt.key !== 'other' && onQuickOption(opt.key)}
              style={[
                styles.quickPill,
                {
                  borderRadius: borderRadius.lg,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundCard,
                  padding: spacing.md,
                  gap: spacing.sm,
                },
              ]}
            >
              <Ionicons name={opt.icon as any} size={22} color={colors.primary} />
              <ThemedText type="defaultSemiBold" style={{ flex: 1 }}>
                {t(language, opt.labelKey as any)}
              </ThemedText>
              {opt.key !== 'other' && (
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              )}
            </Pressable>
          ))}

          {/* Other custom input */}
          <View style={{ gap: spacing.sm }}>
            <TextInput
              style={[styles.input, inputStyle(colors, borderRadius)]}
              value={otherText}
              onChangeText={setOtherText}
              placeholder={t(language, 'otherMeal') + '...'}
              placeholderTextColor={colors.textMuted}
            />
            <Button
              onPress={() => onQuickOption('other')}
              disabled={!otherText.trim() || saving}
              size="sm"
            >
              {t(language, 'addMeal')}
            </Button>
          </View>
        </View>
      )}
    </ScreenScrollView>
  );
}

function inputStyle(colors: any, borderRadius: any) {
  return {
    borderRadius: borderRadius.sm,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.background,
  };
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
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tab: {
    borderWidth: 1,
  },
  input: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});
