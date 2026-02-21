import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';

import Card from '@/components/Card';
import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import RecipeForm, { type RecipeFormValue } from '@/components/recipe/RecipeForm';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { normalizeRecipeIngredientsForSave } from '@/convex/lib/recipeValidation';
import { createRecipe, listRecipes, setRecipeIngredients } from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

const EMPTY_FORM: RecipeFormValue = {
  name: '',
  sourceUrl: '',
  servings: '',
  pricePerServing: '',
  notes: '',
  instructions: '',
  tags: [],
  ingredients: [],
};

export default function RecipesScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  const [search, setSearch] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState<RecipeFormValue>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [importingFromUrl, setImportingFromUrl] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);

  const recipes = useQuery(
    api.recipes.list,
    owner && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, search, tags: selectedTags }
      : 'skip'
  );
  const localRecipes = useLocalQuery(listRecipes, [], !isSignedIn);
  const importRecipe = useAction(api.recipes.importFromUrl);
  const createRecipeInternal = useMutation(api.recipes.createInternal);
  const setIngredients = useMutation(api.recipes.setIngredients);

  const recipeItems = React.useMemo(() => {
    if (isSignedIn) return recipes ?? [];
    const base = localRecipes.data ?? [];
    const query = search.trim().toLowerCase();
    return base.filter((recipe: any) => {
      const name = (recipe.name ?? recipe.title ?? '').toLowerCase();
      const notes = (recipe.notes ?? '').toLowerCase();
      const tags = (recipe.tags ?? []).map((tag: string) => tag.toLowerCase());
      if (query && !`${name} ${notes} ${tags.join(' ')}`.includes(query)) return false;
      if (selectedTags.length && !selectedTags.every((tag) => tags.includes(tag.toLowerCase()))) {
        return false;
      }
      return true;
    });
  }, [isSignedIn, recipes, localRecipes.data, search, selectedTags]);

  const existingTags = React.useMemo(() => {
    const source = isSignedIn ? recipes ?? [] : localRecipes.data ?? [];
    return Array.from(
      new Set(
        source.flatMap((recipe: any) =>
          Array.isArray(recipe.tags) ? recipe.tags.filter((tag: string) => tag.trim().length) : []
        )
      )
    );
  }, [isSignedIn, recipes, localRecipes.data]);

  const onCreate = async () => {
    if (!owner || !form.name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const servings = form.servings.trim() ? Number(form.servings) : undefined;
      const pricePerServing = form.pricePerServing.trim() ? Number(form.pricePerServing) : undefined;
      const ingredientValidation = normalizeRecipeIngredientsForSave(form.ingredients, {
        requireAmount: true,
      });
      if (ingredientValidation.blankNameIndexes.length > 0) {
        setSaveError(t(language, 'ingredientNameRequired'));
        return;
      }
      if (ingredientValidation.missingAmountIndexes.length > 0) {
        setSaveError(t(language, 'recipeAmountsRequired'));
        return;
      }

      let recipeId: string | Id<'recipes'>;
      if (isSignedIn) {
        recipeId = await createRecipeInternal({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          name: form.name.trim(),
          instructions: form.instructions.trim(),
          servings: Number.isFinite(servings) ? servings : undefined,
          pricePerServing: Number.isFinite(pricePerServing) ? pricePerServing : undefined,
          notes: form.notes.trim() || undefined,
          sourceUrl: form.sourceUrl.trim() || undefined,
          tags: form.tags,
        });
        await setIngredients({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          recipeId: recipeId as Id<'recipes'>,
          ingredients: ingredientValidation.ingredients,
        });
      } else {
        recipeId = await createRecipe({
          name: form.name.trim(),
          instructions: form.instructions.trim(),
          servings: Number.isFinite(servings) ? servings : null,
          pricePerServing: Number.isFinite(pricePerServing) ? pricePerServing : null,
          notes: form.notes.trim() || null,
          sourceUrl: form.sourceUrl.trim() || null,
          tags: form.tags,
        });
        await setRecipeIngredients({
          recipeId: String(recipeId),
          ingredients: ingredientValidation.ingredients,
        });
        bumpRefresh();
      }

      setCreating(false);
      setForm(EMPTY_FORM);
      router.push({
        pathname: '/(screens)/recipe/[recipeId]',
        params: { recipeId, edit: '1', requireAmounts: '1' },
      });
    } catch (error: any) {
      setSaveError(error?.message ?? t(language, 'saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onImportFromUrl = async () => {
    if (!owner || !isSignedIn || !entitlements.canUseAi || !form.sourceUrl.trim()) return;
    setImportingFromUrl(true);
    setImportError(null);
    try {
      const recipeId = await importRecipe({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        url: form.sourceUrl.trim(),
      });
      setCreating(false);
      setForm(EMPTY_FORM);
      router.push({
        pathname: '/(screens)/recipe/[recipeId]',
        params: { recipeId, edit: '1', requireAmounts: '1', fromImport: '1' },
      });
    } catch (error: any) {
      setImportError(error?.message ?? t(language, 'autofillFailed'));
    } finally {
      setImportingFromUrl(false);
    }
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <ThemedText type="title">{t(language, 'recipes')}</ThemedText>
        <Button variant={creating ? 'outline' : 'primary'} onPress={() => setCreating((prev) => !prev)}>
          {creating ? t(language, 'cancel') : t(language, 'createRecipe')}
        </Button>
      </View>

      {creating ? (
        <RecipeForm
          language={language}
          value={form}
          onChange={setForm}
          onSave={onCreate}
          saveLabel={t(language, 'save')}
          saving={saving}
          saveError={saveError}
          requireIngredientAmounts
          tagSuggestions={existingTags}
          urlAutofill={
            entitlements.canUseAi && isSignedIn
              ? {
                  onAutofill: onImportFromUrl,
                  loading: importingFromUrl,
                  error: importError,
                }
              : undefined
          }
        />
      ) : null}

      <Card>
        <View style={{ gap: spacing.sm }}>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder={t(language, 'searchRecipes')}
            placeholderTextColor={colors.textMuted}
          />
          {existingTags.length ? (
            <View style={[styles.tagsRow, { gap: spacing.xs }]}>
              {existingTags.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() =>
                      setSelectedTags((prev) =>
                        selected ? prev.filter((current) => current !== tag) : [...prev, tag]
                      )
                    }
                    style={[
                      styles.tagChip,
                      {
                        borderRadius: borderRadius.pill,
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primaryMuted : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText style={[typography.caption, selected ? { color: colors.primary } : undefined]}>
                      {tag}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Card>

      {!isSignedIn && !localRecipes.data ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : recipeItems.length ? (
        <View style={{ gap: spacing.sm }}>
          {recipeItems.map((recipe: any) => (
            <Pressable
              key={recipe._id ?? recipe.id}
              onPress={() =>
                router.push({
                  pathname: '/(screens)/recipe/[recipeId]',
                  params: { recipeId: recipe._id ?? recipe.id },
                })
              }
            >
              <Card>
                <View style={{ gap: spacing.xs }}>
                  <ThemedText type="defaultSemiBold">{recipe.name ?? recipe.title}</ThemedText>
                  <View style={[styles.row, { gap: spacing.sm }]}>
                    {recipe.servings ? (
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {recipe.servings} {t(language, 'servings').toLowerCase()}
                      </ThemedText>
                    ) : null}
                    {recipe.pricePerServing ? (
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {t(language, 'pricePerServing')}: ${recipe.pricePerServing}
                      </ThemedText>
                    ) : null}
                  </View>
                  {Array.isArray(recipe.tags) && recipe.tags.length ? (
                    <View style={[styles.tagsRow, { gap: spacing.xs }]}>
                      {recipe.tags.slice(0, 4).map((tag: string) => (
                        <View
                          key={tag}
                          style={[
                            styles.tagChip,
                            {
                              borderRadius: borderRadius.pill,
                              borderColor: colors.borderLight,
                            },
                          ]}
                        >
                          <ThemedText style={typography.caption}>{tag}</ThemedText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : (
        <ThemedText>{t(language, 'noRecipes')}</ThemedText>
      )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
