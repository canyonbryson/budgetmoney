import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { budgetSetupTemplates } from '@/lib/budgetSetupTemplates';
import {
  encodeSetupState,
  getDefaultSetupState,
  cycleTypeForLength,
  WIZARD_TOTAL_STEPS,
  type BudgetSetupState,
  type RolloverMode,
} from '@/lib/budgetSetupFlow';
import {
  getBudgetHierarchyWithSpent,
  getBudgetSettings,
} from '@/lib/localDb';

export default function BudgetSetupIndexScreen() {
  const params = useLocalSearchParams<{ mode?: string; source?: string }>();
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();
  const { owner, isSignedIn } = useIdentity();

  /* --- existing data for "edit current" option --- */
  const convexHierarchy = useQuery(
    api.budgets.getFullHierarchy,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip',
  );
  const convexSettings = useQuery(
    api.budgets.getSettings,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip',
  );
  const localHierarchy = useLocalQuery(getBudgetHierarchyWithSpent, [], !isSignedIn);
  const localSettings = useLocalQuery(getBudgetSettings, [], !isSignedIn);

  const hierarchy = isSignedIn ? convexHierarchy : localHierarchy.data;
  const settings = isSignedIn ? convexSettings : localSettings.data;
  const hasExistingBudget = (hierarchy?.items?.length ?? 0) > 0;

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '1')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  /* --- handlers --- */
  const navigateWithState = (state: BudgetSetupState) => {
    const finalState: BudgetSetupState =
      params.source === 'onboarding'
        ? { ...state, nextPathAfterFinish: '/(onboarding)/bank' }
        : state;
    router.push({
      pathname: '/(screens)/budget-setup/cycle',
      params: { state: encodeSetupState(finalState) },
    });
  };

  const onPickTemplate = (templateId: string) => {
    navigateWithState(getDefaultSetupState(templateId));
  };

  const onEditExisting = () => {
    if (!hierarchy || !settings) return;
    const allIds: string[] = [];
    const categories = (hierarchy.items ?? []).map((item: any) => {
      const catId = String(item.categoryId);
      allIds.push(catId);
      const subcategories = (item.children ?? []).map((child: any) => {
        const childId = String(child.categoryId);
        allIds.push(childId);
        return {
          name: child.name ?? '',
          amount: child.amount ?? 0,
          existingId: childId,
          rolloverMode: (child.rolloverMode ?? 'none') as RolloverMode,
        };
      });
      return {
        name: item.name ?? '',
        amount: item.amount ?? 0,
        existingId: catId,
        rolloverMode: (item.rolloverMode ?? 'none') as RolloverMode,
        subcategories,
      };
    });

    const state: BudgetSetupState = {
      mode: 'edit',
      templateId: 'none',
      cycleType: cycleTypeForLength(settings.cycleLengthDays ?? 30),
      cycleLengthDays: settings.cycleLengthDays ?? 30,
      anchorDate: settings.anchorDate ?? new Date().toISOString().slice(0, 10),
      incomePerCycle: (settings as any).monthlyIncome ?? 0,
      categories,
      originalCategoryIds: allIds,
    };
    navigateWithState(state);
  };

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>
      {/* Step indicator */}
      <ThemedText
        style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }]}
      >
        {stepLabel}
      </ThemedText>

      <ThemedText type="title">{t(language, 'budgetSetupChooseOption')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupTemplatesHelp')}
      </ThemedText>

      {/* Template cards */}
      <View style={{ gap: spacing.md }}>
        {budgetSetupTemplates
          .filter((tmpl) => tmpl.id !== 'none')
          .map((template) => (
            <Pressable key={template.id} onPress={() => onPickTemplate(template.id)}>
              <Card variant="elevated">
                <View style={{ gap: spacing.xs }}>
                  <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                    {t(language, template.nameKey)}
                  </ThemedText>
                  <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                    {t(language, template.descriptionKey)}
                  </ThemedText>
                  {template.categories.length > 0 && (
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {template.categories.map((c) => c.name).join(', ')}
                    </ThemedText>
                  )}
                </View>
              </Card>
            </Pressable>
          ))}

        {/* Start from scratch */}
        <Pressable onPress={() => onPickTemplate('none')}>
          <Card>
            <View style={{ gap: spacing.xs }}>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                {t(language, 'budgetSetupStartFromScratch')}
              </ThemedText>
              <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                {t(language, 'budgetSetupTemplateNoneDesc')}
              </ThemedText>
            </View>
          </Card>
        </Pressable>

        {/* Edit existing budget */}
        {hasExistingBudget && (
          <Pressable onPress={onEditExisting}>
            <Card variant="accent">
              <View style={{ gap: spacing.xs }}>
                <ThemedText type="defaultSemiBold" style={{ fontSize: 17 }}>
                  {t(language, 'budgetSetupEditExisting')}
                </ThemedText>
                <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                  {t(language, 'budgetSetupEditExistingDesc')}
                </ThemedText>
              </View>
            </Card>
          </Pressable>
        )}
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
});
