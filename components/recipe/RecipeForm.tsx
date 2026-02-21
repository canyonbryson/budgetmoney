import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';
import IngredientEditor, { type IngredientDraft } from '@/components/recipe/IngredientEditor';
import TagInput from '@/components/recipe/TagInput';
import UrlAutofillPanel from '@/components/recipe/UrlAutofillPanel';
import { normalizeRecipeIngredientsForSave } from '@/convex/lib/recipeValidation';

export type RecipeFormValue = {
  name: string;
  sourceUrl: string;
  servings: string;
  pricePerServing: string;
  notes: string;
  instructions: string;
  tags: string[];
  ingredients: IngredientDraft[];
};

type Props = {
  language: string;
  value: RecipeFormValue;
  onChange: (value: RecipeFormValue) => void;
  onSave: () => Promise<void> | void;
  saveLabel: string;
  saving?: boolean;
  editing?: boolean;
  tagSuggestions?: string[];
  saveError?: string | null;
  requireIngredientAmounts?: boolean;
  urlAutofill?: {
    onAutofill: () => Promise<void> | void;
    loading?: boolean;
    error?: string | null;
  };
};

export default function RecipeForm({
  language,
  value,
  onChange,
  onSave,
  saveLabel,
  saving = false,
  editing = true,
  tagSuggestions = [],
  saveError,
  requireIngredientAmounts = false,
  urlAutofill,
}: Props) {
  const { colors, spacing, borderRadius } = useAppTheme();
  const setValue = (patch: Partial<RecipeFormValue>) => onChange({ ...value, ...patch });
  const ingredientValidation = React.useMemo(
    () =>
      normalizeRecipeIngredientsForSave(value.ingredients, {
        requireAmount: requireIngredientAmounts,
      }),
    [requireIngredientAmounts, value.ingredients]
  );
  const hasMissingIngredientAmount =
    ingredientValidation.missingAmountIndexes.length > 0 || ingredientValidation.blankNameIndexes.length > 0;

  return (
    <View style={{ gap: spacing.md }}>
      {urlAutofill ? (
        <Card>
          <UrlAutofillPanel
            language={language}
            url={value.sourceUrl}
            onChangeUrl={(sourceUrl) => setValue({ sourceUrl })}
            onAutofill={urlAutofill.onAutofill}
            loading={urlAutofill.loading}
            error={urlAutofill.error}
          />
        </Card>
      ) : null}

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language as any, 'recipeDetails')}</ThemedText>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={value.name}
            onChangeText={(name) => setValue({ name })}
            placeholder={t(language as any, 'recipeName')}
            placeholderTextColor={colors.textMuted}
          />
          <View style={[styles.row, { gap: spacing.sm }]}>
            <TextInput
              style={[
                styles.input,
                styles.rowInput,
                { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text },
              ]}
              value={value.servings}
              onChangeText={(servings) => setValue({ servings })}
              placeholder={t(language as any, 'servings')}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[
                styles.input,
                styles.rowInput,
                { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text },
              ]}
              value={value.pricePerServing}
              onChangeText={(pricePerServing) => setValue({ pricePerServing })}
              placeholder={t(language as any, 'pricePerServing')}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
            />
          </View>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={value.notes}
            onChangeText={(notes) => setValue({ notes })}
            placeholder={t(language as any, 'notes')}
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language as any, 'tags')}</ThemedText>
          <TagInput
            language={language}
            tags={value.tags}
            onChange={(tags) => setValue({ tags })}
            suggestions={tagSuggestions}
          />
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language as any, 'ingredients')}</ThemedText>
          <IngredientEditor
            language={language}
            editing={editing}
            value={value.ingredients}
            onChange={(ingredients) => setValue({ ingredients })}
            missingAmountIndexes={ingredientValidation.missingAmountIndexes}
          />
          {editing && hasMissingIngredientAmount ? (
            <ThemedText style={{ color: colors.error }}>
              {t(language as any, 'recipeAmountsRequired')}
            </ThemedText>
          ) : null}
        </View>
      </Card>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language as any, 'instructions')}</ThemedText>
          <TextInput
            style={[
              styles.input,
              styles.instructions,
              { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text },
            ]}
            value={value.instructions}
            onChangeText={(instructions) => setValue({ instructions })}
            placeholder={t(language as any, 'instructions')}
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>
      </Card>

      {editing ? (
        <Button onPress={onSave} disabled={saving || !value.name.trim() || hasMissingIngredientAmount}>
          {saveLabel}
        </Button>
      ) : null}
      {saveError ? <ThemedText style={{ color: colors.error }}>{saveError}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  rowInput: {
    flex: 1,
  },
  instructions: {
    minHeight: 160,
    paddingTop: 10,
  },
});
