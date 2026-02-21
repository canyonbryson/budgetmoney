import React from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAction, useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import Card from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import Button from '@/components/Button';
import IngredientEditor, { type IngredientDraft } from '@/components/recipe/IngredientEditor';
import TagInput from '@/components/recipe/TagInput';
import UrlAutofillPanel from '@/components/recipe/UrlAutofillPanel';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import { getRecipeDetail, setRecipeIngredients, updateRecipe as updateLocalRecipe } from '@/lib/localDb';
import { normalizeRecipeIngredientsForSave, splitInstructionSteps } from '@/convex/lib/recipeValidation';
import type { Id } from '@/convex/_generated/dataModel';

type FormValue = {
  name: string;
  sourceUrl: string;
  servings: string;
  pricePerServing: string;
  notes: string;
  instructions: string;
  tags: string[];
  ingredients: IngredientDraft[];
};

const EMPTY_FORM: FormValue = {
  name: '',
  sourceUrl: '',
  servings: '',
  pricePerServing: '',
  notes: '',
  instructions: '',
  tags: [],
  ingredients: [],
};

export default function RecipeDetailScreen() {
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { language } = useSettings();
  const { colors, spacing, borderRadius, typography, shadows } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const recipeIdParam = Array.isArray(params.recipeId) ? params.recipeId[0] : params.recipeId;
  const editModeParam = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const requireAmountsParam = Array.isArray(params.requireAmounts) ? params.requireAmounts[0] : params.requireAmounts;
  const fromImportParam = Array.isArray(params.fromImport) ? params.fromImport[0] : params.fromImport;
  const recipeId = recipeIdParam as Id<'recipes'> | undefined;
  const shouldStartEditing = editModeParam === '1';
  const requireIngredientAmounts = requireAmountsParam !== '0';
  const fromImportFlow = fromImportParam === '1';

  const detail = useQuery(
    api.recipes.getDetail,
    owner && recipeId && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, recipeId }
      : 'skip'
  );
  const localDetail = useLocalQuery(
    () => (recipeId ? getRecipeDetail(String(recipeId)) : Promise.resolve(null)),
    [recipeId],
    !isSignedIn && Boolean(recipeId)
  );
  const updateRecipe = useMutation(api.recipes.update);
  const setIngredients = useMutation(api.recipes.setIngredients);
  const estimateCost = useAction(api.recipes.estimateCost);
  const importRecipe = useAction(api.recipes.importFromUrl);

  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<FormValue>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [urlImporting, setUrlImporting] = React.useState(false);
  const [urlImportError, setUrlImportError] = React.useState<string | null>(null);
  const [estimate, setEstimate] = React.useState<any | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [estimateError, setEstimateError] = React.useState<string | null>(null);

  const recipe = isSignedIn ? detail?.recipe : localDetail.data?.recipe;
  const tagSuggestions = React.useMemo(
    () => (isSignedIn ? detail?.recipe?.tags ?? [] : localDetail.data?.recipe?.tags ?? []),
    [detail?.recipe?.tags, isSignedIn, localDetail.data?.recipe?.tags]
  );

  const setValue = (patch: Partial<FormValue>) => setForm((prev) => ({ ...prev, ...patch }));

  React.useEffect(() => {
    if (!recipe) return;
    const ingredients = (isSignedIn ? detail?.ingredients : localDetail.data?.ingredients) ?? [];
    setForm({
      name: recipe.name ?? recipe.title ?? '',
      servings: recipe.servings ? String(recipe.servings) : '',
      pricePerServing: recipe.pricePerServing ? String(recipe.pricePerServing) : '',
      notes: recipe.notes ?? '',
      instructions: recipe.instructions ?? recipe.content ?? '',
      sourceUrl: (recipe as any).sourceUrl ?? '',
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      ingredients: ingredients.map((ing: any) => ({
        id: ing._id ?? ing.id,
        name: ing.name ?? '',
        quantity: ing.quantity !== undefined && ing.quantity !== null ? String(ing.quantity) : '',
        unit: ing.unit ?? '',
      })),
    });
  }, [detail?.ingredients, isSignedIn, localDetail.data?.ingredients, recipe]);

  React.useEffect(() => {
    if (shouldStartEditing) setEditing(true);
  }, [shouldStartEditing]);

  const computedCostPerServing = React.useMemo(() => {
    const ingredients = (isSignedIn ? detail?.ingredients : localDetail.data?.ingredients) ?? [];
    if (!ingredients.length) return null;
    const totalCost = ingredients.reduce((sum: number, ing: any) => sum + (ing.estimatedCost ?? 0), 0);
    if (!totalCost) return null;
    const srv = recipe?.servings ?? 1;
    return { total: totalCost, perServing: totalCost / srv };
  }, [detail?.ingredients, isSignedIn, localDetail.data?.ingredients, recipe?.servings]);

  const ingredientValidation = React.useMemo(
    () => normalizeRecipeIngredientsForSave(form.ingredients, { requireAmount: requireIngredientAmounts }),
    [form.ingredients, requireIngredientAmounts]
  );
  const hasMissingAmounts =
    ingredientValidation.missingAmountIndexes.length > 0 || ingredientValidation.blankNameIndexes.length > 0;

  const onSave = async () => {
    if (!owner || !recipeId) return;
    setSaving(true);
    setSaveError(null);
    const parsedServings = form.servings.trim() ? Number(form.servings) : undefined;
    const parsedPricePerServing = form.pricePerServing.trim() ? Number(form.pricePerServing) : undefined;
    const safeServings = Number.isFinite(parsedServings) ? parsedServings : undefined;
    const safePricePerServing = Number.isFinite(parsedPricePerServing) ? parsedPricePerServing : undefined;

    if (ingredientValidation.blankNameIndexes.length > 0) {
      setSaveError(t(language, 'ingredientNameRequired'));
      setSaving(false);
      return;
    }
    if (ingredientValidation.missingAmountIndexes.length > 0) {
      setSaveError(t(language, 'recipeAmountsRequired'));
      setSaving(false);
      return;
    }
    try {
      if (!isSignedIn) {
        await updateLocalRecipe({
          recipeId: String(recipeId),
          name: form.name.trim() || localDetail.data?.recipe?.name || 'Recipe',
          instructions: form.instructions.trim() || localDetail.data?.recipe?.instructions || '',
          servings: safeServings,
          pricePerServing: safePricePerServing,
          notes: form.notes.trim() || undefined,
          sourceUrl: form.sourceUrl.trim() || null,
          tags: form.tags,
        });
        await setRecipeIngredients({
          recipeId: String(recipeId),
          ingredients: ingredientValidation.ingredients,
        });
        bumpRefresh();
      } else {
        await updateRecipe({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          recipeId,
          name: form.name.trim() || detail?.recipe?.name || 'Recipe',
          instructions: form.instructions.trim() || detail?.recipe?.instructions || '',
          servings: safeServings,
          pricePerServing: safePricePerServing,
          notes: form.notes.trim() || undefined,
          sourceUrl: form.sourceUrl.trim() || undefined,
          tags: form.tags,
        });
        await setIngredients({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          recipeId,
          ingredients: ingredientValidation.ingredients,
        });
      }
      setEditing(false);
      if (fromImportFlow) {
        router.replace({ pathname: '/(screens)/recipe/[recipeId]', params: { recipeId } });
      }
    } catch (err: any) {
      setSaveError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onAutofillFromUrl = async () => {
    if (!owner || !recipeId || !isSignedIn || !entitlements.canUseAi || !form.sourceUrl.trim()) return;
    setUrlImporting(true);
    setUrlImportError(null);
    try {
      await importRecipe({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        url: form.sourceUrl.trim(),
        recipeId,
      });
      router.replace({
        pathname: '/(screens)/recipe/[recipeId]',
        params: { recipeId, edit: '1', requireAmounts: '1', fromImport: '1' },
      });
    } catch (error: any) {
      setUrlImportError(error?.message ?? t(language, 'autofillFailed'));
    } finally {
      setUrlImporting(false);
    }
  };

  const onEstimate = async () => {
    if (!owner || !recipeId || !entitlements.canUseAi) return;
    setEstimating(true);
    setEstimateError(null);
    try {
      const result = await estimateCost({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        recipeId,
      });
      setEstimate(result ?? null);
    } catch (err: any) {
      setEstimateError(err?.message ?? t(language, 'estimateFailed'));
    } finally {
      setEstimating(false);
    }
  };

  if (!isReady || (isSignedIn ? detail : localDetail.data) === undefined) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!recipe) {
    return (
      <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
        <ThemedText>{t(language, 'noRecipes')}</ThemedText>
      </ScreenScrollView>
    );
  }

  const recipeSourceUrl = (recipe as any).sourceUrl as string | undefined;
  const instructionSteps = splitInstructionSteps(form.instructions || recipe.instructions || recipe.content || '');

  /* ── Import notice banner ── */
  const importBanner = editing && fromImportFlow ? (
    <View style={[styles.banner, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md, padding: spacing.md }]}>
      <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
      <ThemedText style={[typography.caption, { color: colors.primary, flex: 1 }]}>
        {t(language, 'recipeImportNeedsAmounts')}
      </ThemedText>
    </View>
  ) : null;

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>

      {/* ── HERO HEADER ── */}
      <View style={{ gap: spacing.sm }}>
        <View style={styles.headerRow}>
          {editing ? (
            <TextInput
              style={[
                styles.titleInput,
                {
                  borderBottomColor: colors.borderLight,
                  color: colors.text,
                  fontFamily: typography.title.fontFamily,
                  fontSize: typography.title.fontSize,
                  fontWeight: typography.title.fontWeight,
                },
              ]}
              value={form.name}
              onChangeText={(name) => setValue({ name })}
              placeholder={t(language, 'recipeName')}
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <ThemedText type="title" style={{ flex: 1 }}>{recipe.name ?? recipe.title}</ThemedText>
          )}
          <Button variant="ghost" size="sm" onPress={() => setEditing(!editing)}>
            {editing ? t(language, 'cancel') : t(language, 'edit')}
          </Button>
        </View>

        {importBanner}

        {/* Meta row */}
        <View style={[styles.metaRow, { gap: spacing.md }]}>
          {(editing || recipe.servings) ? (
            <View style={[styles.metaChip, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}>
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              {editing ? (
                <TextInput
                  style={[styles.metaInput, { color: colors.primary, fontFamily: typography.caption.fontFamily }]}
                  value={form.servings}
                  onChangeText={(servings) => setValue({ servings })}
                  placeholder="#"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              ) : (
                <ThemedText style={[typography.caption, { color: colors.primary }]}>
                  {recipe.servings} {t(language, 'servings').toLowerCase()}
                </ThemedText>
              )}
            </View>
          ) : null}

          {(computedCostPerServing || estimate || (editing && !computedCostPerServing)) ? (
            <View style={[styles.metaChip, { backgroundColor: colors.accentMuted, borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }]}>
              <Ionicons name="cash-outline" size={14} color={colors.accent} />
              {editing ? (
                <TextInput
                  style={[styles.metaInput, { color: colors.accent, fontFamily: typography.caption.fontFamily }]}
                  value={form.pricePerServing}
                  onChangeText={(pricePerServing) => setValue({ pricePerServing })}
                  placeholder={t(language, 'pricePerServing')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              ) : (
                <ThemedText style={[typography.caption, { color: colors.accent }]}>
                  {formatMoney(
                    recipe.pricePerServing ?? estimate?.costPerServing ?? computedCostPerServing?.perServing ?? 0,
                    estimate?.currency ?? 'USD'
                  )}/{t(language, 'servings').toLowerCase().charAt(0)}
                </ThemedText>
              )}
            </View>
          ) : null}
        </View>

        {/* Notes */}
        {editing ? (
          <TextInput
            style={[styles.notesInput, { borderColor: colors.borderLight, borderRadius: borderRadius.sm, color: colors.text }]}
            value={form.notes}
            onChangeText={(notes) => setValue({ notes })}
            placeholder={t(language, 'notes')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
        ) : recipe.notes ? (
          <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>{recipe.notes}</ThemedText>
        ) : null}

        {/* Source URL */}
        {editing && isSignedIn && entitlements.canUseAi ? (
          <UrlAutofillPanel
            language={language}
            url={form.sourceUrl}
            onChangeUrl={(sourceUrl) => setValue({ sourceUrl })}
            onAutofill={onAutofillFromUrl}
            loading={urlImporting}
            error={urlImportError}
          />
        ) : recipeSourceUrl && !editing ? (
          <Pressable
            onPress={() => Linking.openURL(recipeSourceUrl)}
            style={[styles.sourceLink, { gap: 6 }]}
          >
            <Ionicons name="link-outline" size={14} color={colors.primary} />
            <ThemedText style={[typography.caption, { color: colors.primary }]} numberOfLines={1}>
              {recipeSourceUrl}
            </ThemedText>
          </Pressable>
        ) : null}

        {/* Tags */}
        {editing ? (
          <TagInput
            language={language}
            tags={form.tags}
            onChange={(tags) => setValue({ tags })}
            suggestions={tagSuggestions}
          />
        ) : Array.isArray(recipe.tags) && recipe.tags.length ? (
          <View style={[styles.tagsRow, { gap: spacing.xs }]}>
            {recipe.tags.map((tag: string) => (
              <View
                key={tag}
                style={[
                  styles.tagChip,
                  { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
                ]}
              >
                <ThemedText style={[typography.caption, { color: colors.primary }]}>{tag}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── INGREDIENTS (single section) ── */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHeader}>
            <Ionicons name="leaf-outline" size={18} color={colors.primary} />
            <ThemedText type="subtitle">{t(language, 'ingredients')}</ThemedText>
          </View>

          {editing ? (
            <View style={{ gap: spacing.sm }}>
              <IngredientEditor
                language={language}
                editing
                value={form.ingredients}
                onChange={(ingredients) => setValue({ ingredients })}
                missingAmountIndexes={ingredientValidation.missingAmountIndexes}
              />
              {hasMissingAmounts ? (
                <View style={[styles.banner, { backgroundColor: `${colors.error}18`, borderRadius: borderRadius.sm, padding: spacing.sm }]}>
                  <Ionicons name="alert-circle-outline" size={15} color={colors.error} />
                  <ThemedText style={[typography.caption, { color: colors.error, flex: 1 }]}>
                    {t(language, 'recipeAmountsRequired')}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : form.ingredients.length ? (
            <View style={{ gap: spacing.xs }}>
              {form.ingredients.map((ing, index) => (
                <View key={ing.id ?? `${ing.name}-${index}`} style={[styles.ingredientRow, { gap: spacing.sm }]}>
                  <View style={[styles.ingredientBullet, { backgroundColor: colors.primary }]} />
                  <ThemedText style={{ flex: 1 }}>
                    {ing.quantity ? (
                      <ThemedText style={{ fontWeight: '600' }}>{ing.quantity} </ThemedText>
                    ) : null}
                    {ing.unit ? (
                      <ThemedText style={{ color: colors.textSecondary }}>{ing.unit} </ThemedText>
                    ) : null}
                    {ing.name}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noItems')}</ThemedText>
          )}
        </View>
      </Card>

      {/* ── INSTRUCTIONS (single section) ── */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-outline" size={18} color={colors.primary} />
            <ThemedText type="subtitle">{t(language, 'instructions')}</ThemedText>
          </View>

          {editing ? (
            <TextInput
              style={[
                styles.instructionsInput,
                {
                  borderRadius: borderRadius.sm,
                  borderColor: colors.borderLight,
                  color: colors.text,
                  backgroundColor: colors.backgroundElevated,
                },
              ]}
              value={form.instructions}
              onChangeText={(instructions) => setValue({ instructions })}
              placeholder={t(language, 'instructions')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
            />
          ) : instructionSteps.length ? (
            <View style={{ gap: spacing.md }}>
              {instructionSteps.map((step, index) => (
                <View key={`step-${index}`} style={[styles.stepRow, { gap: spacing.md }]}>
                  <View
                    style={[
                      styles.stepNumber,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: borderRadius.md,
                        ...shadows.sm,
                      },
                    ]}
                  >
                    <ThemedText style={[styles.stepNumberText, { color: colors.textOnPrimary }]}>
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.stepText, { color: colors.text }]}>{step}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noItems')}</ThemedText>
          )}
        </View>
      </Card>

      {/* ── PRICING ── */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calculator-outline" size={18} color={colors.primary} />
            <ThemedText type="subtitle">{t(language, 'pricingEstimated')}</ThemedText>
          </View>

          {(computedCostPerServing && !estimate) ? (
            <View style={[styles.priceGrid, { gap: spacing.sm }]}>
              <View style={[styles.priceStat, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md, padding: spacing.md }]}>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>{t(language, 'estimatedTotal')}</ThemedText>
                <ThemedText type="subtitle">{formatMoney(computedCostPerServing.total, 'USD')}</ThemedText>
              </View>
              <View style={[styles.priceStat, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md, padding: spacing.md }]}>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>{t(language, 'costPerServing')}</ThemedText>
                <ThemedText type="subtitle">{formatMoney(computedCostPerServing.perServing, 'USD')}</ThemedText>
              </View>
            </View>
          ) : null}

          <Button onPress={onEstimate} disabled={estimating || !entitlements.canUseAi}>
            {estimating ? '...' : t(language, 'estimateCost')}
          </Button>

          {estimate ? (
            <View style={{ gap: spacing.sm }}>
              <View style={[styles.priceGrid, { gap: spacing.sm }]}>
                <View style={[styles.priceStat, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md, padding: spacing.md }]}>
                  <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>{t(language, 'estimatedTotal')}</ThemedText>
                  <ThemedText type="subtitle">
                    {formatMoney(estimate.totalCost ?? 0, estimate.currency ?? 'USD')}
                  </ThemedText>
                </View>
                <View style={[styles.priceStat, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.md, padding: spacing.md }]}>
                  <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>{t(language, 'costPerServing')}</ThemedText>
                  <ThemedText type="subtitle">
                    {formatMoney(estimate.costPerServing ?? 0, estimate.currency ?? 'USD')}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.statsRow, { gap: spacing.md }]}>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                  {t(language, 'receiptPrices')}: {estimate.receiptCount ?? 0}
                </ThemedText>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                  {t(language, 'estimatedPrices')}: {estimate.onlineCount ?? 0}
                </ThemedText>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                  {t(language, 'confidence')}: {Math.round((estimate.confidence ?? 0) * 100)}%
                </ThemedText>
              </View>
            </View>
          ) : null}
          {estimateError ? <ThemedText style={{ color: colors.error }}>{estimateError}</ThemedText> : null}
        </View>
      </Card>

      {/* ── SAVE BAR ── */}
      {editing ? (
        <View style={{ gap: spacing.sm }}>
          <Button onPress={onSave} disabled={saving || !form.name.trim() || hasMissingAmounts}>
            {saving ? '...' : t(language, 'save')}
          </Button>
          {saveError ? <ThemedText style={{ color: colors.error, textAlign: 'center' }}>{saveError}</ThemedText> : null}
        </View>
      ) : null}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  titleInput: {
    flex: 1,
    borderBottomWidth: 1,
    paddingBottom: 6,
    minHeight: 36,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaInput: {
    fontSize: 13,
    minWidth: 32,
    paddingVertical: 0,
  },
  notesInput: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
    fontSize: 14,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagChip: {
    // filled via inline styles
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  instructionsInput: {
    minHeight: 160,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    lineHeight: 22,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 15,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    paddingTop: 5,
    lineHeight: 22,
  },
  priceGrid: {
    flexDirection: 'row',
  },
  priceStat: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
