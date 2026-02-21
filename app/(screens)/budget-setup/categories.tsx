import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import {
  decodeSetupState,
  encodeSetupState,
  getBudgetSetupStepPath,
  getNextBudgetSetupStep,
  getPreviousBudgetSetupStep,
  WIZARD_TOTAL_STEPS,
  type BudgetSetupCategoryDraft,
  type BudgetSetupSubcategoryDraft,
} from '@/lib/budgetSetupFlow';

function makeBlankSub(): BudgetSetupSubcategoryDraft {
  return { name: '', amount: 0, rolloverMode: 'none' };
}

export default function BudgetSetupCategoriesScreen() {
  const params = useLocalSearchParams<{ state?: string; templateId?: string }>();
  const initial = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();

  const [categories, setCategories] = React.useState<BudgetSetupCategoryDraft[]>(
    initial.categories.length > 0
      ? initial.categories
      : [{ name: '', amount: 0, rolloverMode: 'none', subcategories: [] }],
  );
  const [error, setError] = React.useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = React.useState<number | null>(null);

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '4')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  const onBack = () => {
    const previousStep = getPreviousBudgetSetupStep('categories');
    if (!previousStep) return;
    const state = { ...initial, categories };
    router.replace({
      pathname: getBudgetSetupStepPath(previousStep),
      params: { state: encodeSetupState(state) },
    });
  };

  /* --- category operations --- */
  const onAddCategory = () => {
    setCategories((prev) => [...prev, { name: '', amount: 0, rolloverMode: 'none', subcategories: [] }]);
  };

  const onRemoveCategory = (idx: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
    else if (expandedIdx !== null && expandedIdx > idx) setExpandedIdx(expandedIdx - 1);
  };

  const onChangeCategoryName = (idx: number, name: string) => {
    setCategories((prev) => prev.map((c, i) => (i === idx ? { ...c, name } : c)));
  };

  /* --- subcategory operations --- */
  const onAddSubcategory = (catIdx: number) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIdx ? { ...c, subcategories: [...c.subcategories, makeBlankSub()] } : c,
      ),
    );
  };

  const onRemoveSubcategory = (catIdx: number, subIdx: number) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIdx
          ? { ...c, subcategories: c.subcategories.filter((_, si) => si !== subIdx) }
          : c,
      ),
    );
  };

  const onChangeSubcategoryName = (catIdx: number, subIdx: number, name: string) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIdx
          ? {
              ...c,
              subcategories: c.subcategories.map((s, si) =>
                si === subIdx ? { ...s, name } : s,
              ),
            }
          : c,
      ),
    );
  };

  /* --- continue --- */
  const onContinue = () => {
    const cleaned = categories
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        subcategories: c.subcategories
          .map((s) => ({ ...s, name: s.name.trim() }))
          .filter((s) => s.name.length > 0),
      }))
      .filter((c) => c.name.length > 0);

    if (!cleaned.length) {
      setError(t(language, 'budgetSetupNeedCategory'));
      return;
    }

    setError(null);
    const nextStep = getNextBudgetSetupStep('categories');
    if (!nextStep) return;
    const state = { ...initial, categories: cleaned };
    router.replace({
      pathname: getBudgetSetupStepPath(nextStep),
      params: { state: encodeSetupState(state) },
    });
  };

  const inputStyle = [
    styles.input,
    {
      borderRadius: borderRadius.md,
      borderColor: colors.borderLight,
      color: colors.text,
      backgroundColor: colors.backgroundCard,
      fontFamily: typography.body.fontFamily,
    },
  ];

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>
      <ThemedText
        style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }]}
      >
        {stepLabel}
      </ThemedText>

      <ThemedText type="title">{t(language, 'budgetSetupStepCategories')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupCategoriesHelp')}
      </ThemedText>

      <View style={{ gap: spacing.md }}>
        {categories.map((cat, idx) => {
          const isExpanded = expandedIdx === idx;
          return (
            <Card key={idx}>
              <View style={{ gap: spacing.sm }}>
                {/* Category name row */}
                <View style={[styles.row, { gap: spacing.sm }]}>
                  <TextInput
                    style={[inputStyle, { flex: 1 }]}
                    value={cat.name}
                    onChangeText={(val) => onChangeCategoryName(idx, val)}
                    placeholder={t(language, 'categoryName')}
                    placeholderTextColor={colors.textMuted}
                  />
                  <Pressable
                    onPress={() => onRemoveCategory(idx)}
                    style={[
                      styles.removeBtn,
                      { borderRadius: borderRadius.md, borderColor: colors.borderLight },
                    ]}
                  >
                    <ThemedText style={[typography.caption, { color: colors.error }]}>
                      {t(language, 'delete')}
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Toggle subcategories */}
                <Pressable
                  onPress={() => setExpandedIdx(isExpanded ? null : idx)}
                  style={{ paddingVertical: 4 }}
                >
                  <ThemedText style={[typography.caption, { color: colors.primary }]}>
                    {isExpanded ? '▾' : '▸'} {t(language, 'subcategories')} ({cat.subcategories.length})
                  </ThemedText>
                </Pressable>

                {/* Subcategory list */}
                {isExpanded && (
                  <View
                    style={{
                      gap: spacing.sm,
                      paddingLeft: spacing.md,
                      borderLeftWidth: 2,
                      borderLeftColor: colors.borderLight,
                    }}
                  >
                    {cat.subcategories.map((sub, subIdx) => (
                      <View key={subIdx} style={[styles.row, { gap: spacing.sm }]}>
                        <TextInput
                          style={[inputStyle, { flex: 1 }]}
                          value={sub.name}
                          onChangeText={(val) => onChangeSubcategoryName(idx, subIdx, val)}
                          placeholder={t(language, 'subcategoryName')}
                          placeholderTextColor={colors.textMuted}
                        />
                        <Pressable
                          onPress={() => onRemoveSubcategory(idx, subIdx)}
                          style={[
                            styles.removeBtn,
                            { borderRadius: borderRadius.md, borderColor: colors.borderLight },
                          ]}
                        >
                          <ThemedText style={[typography.caption, { color: colors.error }]}>
                            {t(language, 'delete')}
                          </ThemedText>
                        </Pressable>
                      </View>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onPress={() => onAddSubcategory(idx)}
                    >
                      {t(language, 'budgetSetupAddSubcategory')}
                    </Button>
                  </View>
                )}
              </View>
            </Card>
          );
        })}
      </View>

      <Button variant="secondary" onPress={onAddCategory}>
        {t(language, 'budgetSetupAddCategory')}
      </Button>

      {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}

      <View style={[styles.row, { gap: spacing.sm }]}>
        <Button variant="outline" style={{ flex: 1 }} onPress={onBack}>
          {t(language, 'back')}
        </Button>
        <Button style={{ flex: 1 }} onPress={onContinue}>
          {t(language, 'continue')}
        </Button>
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  removeBtn: {
    borderWidth: 1,
    height: 48,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
