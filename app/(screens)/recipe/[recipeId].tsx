import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/Button';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import { getRecipeDetail, setRecipeIngredients, updateRecipe as updateLocalRecipe } from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

export default function RecipeDetailScreen() {
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { language } = useSettings();
  const { colors, spacing, borderRadius, shadows } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const recipeIdParam = Array.isArray(params.recipeId) ? params.recipeId[0] : params.recipeId;
  const recipeId = recipeIdParam as Id<'recipes'> | undefined;

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

  const [title, setTitle] = React.useState('');
  const [servings, setServings] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [content, setContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [estimate, setEstimate] = React.useState<any | null>(null);
  const [estimating, setEstimating] = React.useState(false);
  const [estimateError, setEstimateError] = React.useState<string | null>(null);
  const [ingredientDrafts, setIngredientDrafts] = React.useState<
    { id?: string; name: string; quantity: string; unit: string }[]
  >([]);

  React.useEffect(() => {
    const source = isSignedIn ? detail?.recipe : localDetail.data?.recipe;
    if (!source) return;
    setTitle(source.title ?? '');
    setServings(source.servings ? String(source.servings) : '');
    setNotes(source.notes ?? '');
    setContent(source.content ?? '');
  }, [detail?.recipe, localDetail.data, isSignedIn]);

  React.useEffect(() => {
    const ingredients = (isSignedIn ? detail?.ingredients : localDetail.data?.ingredients) ?? [];
    setIngredientDrafts(
      ingredients.map((ing: any) => ({
        id: ing._id ?? ing.id,
        name: ing.name ?? '',
        quantity: ing.quantity !== undefined && ing.quantity !== null ? String(ing.quantity) : '',
        unit: ing.unit ?? '',
      }))
    );
  }, [detail?.ingredients, localDetail.data?.ingredients, isSignedIn]);

  const onSave = async () => {
    if (!owner || !recipeId) return;
    setSaving(true);
    setSaveError(null);
    const parsedServings = servings.trim() ? Number(servings) : undefined;
    const safeServings = Number.isFinite(parsedServings) ? parsedServings : undefined;
    const parsedIngredients = ingredientDrafts
      .map((draft) => {
        const name = draft.name.trim();
        const quantity = draft.quantity.trim().length ? Number(draft.quantity) : undefined;
        const unit = draft.unit.trim() || undefined;
        return {
          name,
          quantity: Number.isFinite(quantity) ? quantity : undefined,
          unit,
        };
      })
      .filter((ing) => ing.name.length > 0);
    try {
      if (!isSignedIn) {
        await updateLocalRecipe({
          recipeId: String(recipeId),
          title: title.trim() || localDetail.data?.recipe?.title || 'Recipe',
          content: content.trim() || localDetail.data?.recipe?.content || '',
          servings: safeServings,
          notes: notes.trim() || undefined,
        });
        await setRecipeIngredients({
          recipeId: String(recipeId),
          ingredients: parsedIngredients,
        });
        bumpRefresh();
      } else {
        await updateRecipe({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          recipeId,
          title: title.trim() || detail?.recipe?.title || 'Recipe',
          content: content.trim() || detail?.recipe?.content || '',
          servings: safeServings,
          notes: notes.trim() || undefined,
        });
        await setIngredients({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          recipeId,
          ingredients: parsedIngredients,
        });
      }
    } catch (err: any) {
      setSaveError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setSaving(false);
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

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if ((isSignedIn ? detail : localDetail.data) === undefined) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!(isSignedIn ? detail : localDetail.data)) {
    return (
      <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
        <ThemedText>{t(language, 'noRecipes')}</ThemedText>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <Button onPress={() => router.back()}>{t(language, 'viewAll')}</Button>

      <ThemedText type="title">{t(language, 'recipeDetails')}</ThemedText>

      <ThemedView style={[styles.card, { gap: spacing.sm + 2, padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.borderLight, ...shadows.sm }]}>
        <ThemedText type="subtitle">{t(language, 'recipes')}</ThemedText>
        <TextInput
          style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={title}
          onChangeText={setTitle}
          placeholder={t(language, 'recipeTitle')}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={servings}
          onChangeText={setServings}
          placeholder={t(language, 'servings')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={notes}
          onChangeText={setNotes}
          placeholder={t(language, 'notes')}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[styles.input, styles.multiline, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={content}
          onChangeText={setContent}
          placeholder={t(language, 'content')}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
        />
        <Button onPress={onSave} disabled={saving}>
          {t(language, 'save')}
        </Button>
        {saveError ? <ThemedText style={{ color: colors.error }}>{saveError}</ThemedText> : null}
      </ThemedView>

      <ThemedView style={[styles.card, { gap: spacing.sm + 2, padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.borderLight, ...shadows.sm }]}>
        <ThemedText type="subtitle">{t(language, 'ingredients')}</ThemedText>
        {ingredientDrafts.length ? (
          <ThemedView style={{ gap: spacing.sm }}>
            {ingredientDrafts.map((ing, index) => (
              <View key={ing.id ?? `${ing.name}-${index}`} style={[styles.ingredientRow, { gap: spacing.sm }]}>
                <TextInput
                  style={[styles.input, styles.inputFlex, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                  value={ing.name}
                  onChangeText={(val) =>
                    setIngredientDrafts((prev) =>
                      prev.map((row, idx) => (idx === index ? { ...row, name: val } : row))
                    )
                  }
                  placeholder={t(language, 'itemName')}
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                  value={ing.quantity}
                  onChangeText={(val) =>
                    setIngredientDrafts((prev) =>
                      prev.map((row, idx) => (idx === index ? { ...row, quantity: val } : row))
                    )
                  }
                  placeholder={t(language, 'quantity')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                  value={ing.unit}
                  onChangeText={(val) =>
                    setIngredientDrafts((prev) =>
                      prev.map((row, idx) => (idx === index ? { ...row, unit: val } : row))
                    )
                  }
                  placeholder={t(language, 'unit')}
                  placeholderTextColor={colors.textMuted}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setIngredientDrafts((prev) => prev.filter((_, idx) => idx !== index))}
                >
                  {t(language, 'delete')}
                </Button>
              </View>
            ))}
          </ThemedView>
        ) : (
          <ThemedText>{t(language, 'noItems')}</ThemedText>
        )}
        <Button
          variant="outline"
          size="sm"
          onPress={() => setIngredientDrafts((prev) => [...prev, { name: '', quantity: '', unit: '' }])}
        >
          {t(language, 'addItem')}
        </Button>
      </ThemedView>

      <ThemedView style={[styles.card, { gap: spacing.sm + 2, padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.borderLight, ...shadows.sm }]}>
        <ThemedText type="subtitle">{t(language, 'pricingEstimated')}</ThemedText>
        <Button onPress={onEstimate} disabled={estimating || !entitlements.canUseAi}>
          {t(language, 'estimateCost')}
        </Button>
        {estimate ? (
          <ThemedView style={{ gap: 4 }}>
            <ThemedText>
              {t(language, 'estimatedTotal')}:{' '}
              {formatMoney(estimate.totalCost ?? 0, estimate.currency ?? 'USD')}
            </ThemedText>
            <ThemedText>
              {t(language, 'costPerServing')}:{' '}
              {formatMoney(estimate.costPerServing ?? 0, estimate.currency ?? 'USD')}
            </ThemedText>
            <ThemedText>
              {t(language, 'receiptPrices')}: {estimate.receiptCount ?? 0}
            </ThemedText>
            <ThemedText>
              {t(language, 'estimatedPrices')}: {estimate.onlineCount ?? 0}
            </ThemedText>
            <ThemedText>
              {t(language, 'missingPrices')}: {estimate.missingCount ?? 0}
            </ThemedText>
            <ThemedText>
              {t(language, 'confidence')}: {Math.round((estimate.confidence ?? 0) * 100)}%
            </ThemedText>
          </ThemedView>
        ) : null}
        {estimateError ? <ThemedText style={{ color: colors.error }}>{estimateError}</ThemedText> : null}
      </ThemedView>
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
  card: {
    borderWidth: 1,
  },
  input: {
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  inputFlex: {
    flex: 1,
    minWidth: 140,
  },
  multiline: {
    height: 120,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});
