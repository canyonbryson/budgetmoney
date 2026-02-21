import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useLocalDb } from '@/contexts/LocalDbContext';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import {
  decodeSetupState,
  encodeSetupState,
  computeHardSyncDiff,
  getBudgetSetupStepPath,
  getPreviousBudgetSetupStep,
  WIZARD_TOTAL_STEPS,
  type RolloverMode,
} from '@/lib/budgetSetupFlow';
import {
  createCategory as createLocalCategory,
  getCategories as getLocalCategories,
  removeCategory as removeLocalCategory,
  updateBudgetSettings,
  upsertBudget as upsertLocalBudget,
  setCategoryRolloverMode as setLocalRolloverMode,
} from '@/lib/localDb';
import { formatMoney } from '@/lib/money';
import type { Id } from '@/convex/_generated/dataModel';
import type { TranslationKey } from '@/i18n';

const CYCLE_LABEL: Record<string, TranslationKey> = {
  monthly: 'cycleMonthly',
  semiMonthly: 'cycleSemiMonthly',
  biweekly: 'cycleBiweekly',
};

export default function BudgetSetupReviewScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = React.useMemo(() => decodeSetupState(params.state), [params.state]);
  const { language } = useSettings();
  const { colors, spacing, typography } = useAppTheme();
  const { owner, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();

  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);
  const upsertBudget = useMutation(api.budgets.upsert);
  const updateSettings = useMutation(api.budgets.updateSettings);
  const setRolloverMode = useMutation(api.categories.setRolloverMode);

  const existingCategories = useQuery(
    api.categories.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip',
  );

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const stepLabel = t(language, 'budgetSetupStep')
    .replace('{current}', '7')
    .replace('{total}', String(WIZARD_TOTAL_STEPS));

  const diff = React.useMemo(() => computeHardSyncDiff(state), [state]);
  const totalAllocated = state.categories.reduce((sum, c) => sum + c.amount, 0);

  const onBack = () => {
    const previousStep = getPreviousBudgetSetupStep('review');
    if (!previousStep) return;
    router.replace({
      pathname: getBudgetSetupStepPath(previousStep),
      params: { state: encodeSetupState(state) },
    });
  };

  /* ---- save ---- */
  const onFinish = async () => {
    if (!owner || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (!isSignedIn) {
        await applyLocal();
        bumpRefresh();
      } else {
        await applyConvex();
      }
      router.replace(state.nextPathAfterFinish ?? '/(tabs)/budgets');
    } catch (err: any) {
      setError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /* ---- Convex apply ---- */
  const applyConvex = async () => {
    if (!owner) return;
    const ow = { ownerType: owner.ownerType, ownerId: owner.ownerId };

    // 1. Update settings
    await updateSettings({
      ...ow,
      cycleLengthDays: state.cycleLengthDays,
      anchorDate: state.anchorDate,
      monthlyIncome: state.incomePerCycle,
    });

    // 2. Delete removed categories (children first, ignore errors for categories with transactions)
    for (const id of diff.deletes) {
      try {
        await removeCategory({ ...ow, id: id as Id<'categories'> });
      } catch {
        // Category may have transactions; set budget to 0 instead
        try {
          await upsertBudget({ ...ow, categoryId: id as Id<'categories'>, amount: 0 });
        } catch { /* ignore */ }
      }
    }

    // 3. Update existing categories
    for (const upd of diff.updates) {
      try {
        await updateCategory({
          ...ow,
          id: upd.existingId as Id<'categories'>,
          name: upd.name,
          parentId: upd.parentExistingId as Id<'categories'> | undefined,
        });
      } catch { /* may not need update if name unchanged */ }
      await upsertBudget({ ...ow, categoryId: upd.existingId as Id<'categories'>, amount: upd.amount });
      await setRolloverMode({
        ...ow,
        id: upd.existingId as Id<'categories'>,
        rolloverMode: upd.rolloverMode,
      });
    }

    // 4. Create new categories
    // Build name→id map of existing categories to avoid duplicates
    const existingByName = new Map(
      (existingCategories ?? []).map((cat) => [(cat.name ?? '').toLowerCase(), cat._id]),
    );
    // Also track newly-created parent IDs for subcategory linking
    const createdParents = new Map<string, Id<'categories'>>();

    for (const cr of diff.creates) {
      const existingId = existingByName.get(cr.name.toLowerCase());
      let categoryId: Id<'categories'>;

      if (existingId) {
        categoryId = existingId;
      } else {
        const parentId = cr.parentName
          ? createdParents.get(cr.parentName) ??
            existingByName.get(cr.parentName.toLowerCase()) ??
            undefined
          : undefined;
        categoryId = await createCategory({ ...ow, name: cr.name, parentId, categoryKind: 'expense' });
        existingByName.set(cr.name.toLowerCase(), categoryId);
      }

      if (!cr.parentName) {
        createdParents.set(cr.name, categoryId);
      }

      await upsertBudget({ ...ow, categoryId, amount: cr.amount });
      await setRolloverMode({ ...ow, id: categoryId, rolloverMode: cr.rolloverMode });
    }
  };

  /* ---- Local apply ---- */
  const applyLocal = async () => {
    // 1. Update settings
    await updateBudgetSettings(state.cycleLengthDays, state.anchorDate, state.incomePerCycle);

    // 2. Delete removed categories
    for (const id of diff.deletes) {
      try {
        await removeLocalCategory(id);
      } catch {
        try {
          await upsertLocalBudget(id, 0);
        } catch { /* ignore */ }
      }
    }

    // 3. Update existing
    for (const upd of diff.updates) {
      await upsertLocalBudget(upd.existingId, upd.amount);
      await setLocalRolloverMode(upd.existingId, upd.rolloverMode);
    }

    // 4. Create new
    const localCats = await getLocalCategories();
    const localByName = new Map(localCats.map((c) => [c.name.toLowerCase(), c._id]));
    const createdParents = new Map<string, string>();

    for (const cr of diff.creates) {
      let catId = localByName.get(cr.name.toLowerCase());
      if (!catId) {
        const parentId = cr.parentName
          ? createdParents.get(cr.parentName) ??
            localByName.get(cr.parentName.toLowerCase()) ??
            undefined
          : undefined;
        await createLocalCategory(cr.name, parentId, 'expense');
        const refreshed = await getLocalCategories();
        const found = refreshed.find((c) => c.name.toLowerCase() === cr.name.toLowerCase());
        catId = found?._id;
        if (catId) localByName.set(cr.name.toLowerCase(), catId);
      }
      if (!cr.parentName && catId) {
        createdParents.set(cr.name, catId);
      }
      if (catId) {
        await upsertLocalBudget(catId, cr.amount);
        await setLocalRolloverMode(catId, cr.rolloverMode);
      }
    }
  };

  const cycleLabel = t(language, CYCLE_LABEL[state.cycleType] ?? 'cycleMonthly');

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>
      <ThemedText
        style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.5 }]}
      >
        {stepLabel}
      </ThemedText>

      <ThemedText type="title">{t(language, 'budgetSetupStepReview')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>
        {t(language, 'budgetSetupReviewHelp')}
      </ThemedText>

      {/* Summary */}
      <Card variant="muted">
        <View style={{ gap: spacing.sm }}>
          <View style={styles.summaryRow}>
            <ThemedText style={[typography.body, { color: colors.textMuted }]}>
              {t(language, 'budgetSetupReviewCycle')}
            </ThemedText>
            <ThemedText type="defaultSemiBold">{cycleLabel}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[typography.body, { color: colors.textMuted }]}>
              {t(language, 'budgetSetupReviewIncome')}
            </ThemedText>
            <ThemedText type="defaultSemiBold">{formatMoney(state.incomePerCycle)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[typography.body, { color: colors.textMuted }]}>
              {t(language, 'totalAllocated')}
            </ThemedText>
            <ThemedText type="defaultSemiBold">{formatMoney(totalAllocated)}</ThemedText>
          </View>
          <View style={styles.summaryRow}>
            <ThemedText style={[typography.body, { color: colors.textMuted }]}>
              {t(language, 'budgetSetupCategoryCount')}
            </ThemedText>
            <ThemedText type="defaultSemiBold">{state.categories.length}</ThemedText>
          </View>
        </View>
      </Card>

      {/* Category breakdown */}
      <View style={{ gap: spacing.md }}>
        {state.categories.map((cat, idx) => (
          <Card key={idx}>
            <View style={{ gap: spacing.xs }}>
              <View style={styles.summaryRow}>
                <ThemedText type="defaultSemiBold">{cat.name}</ThemedText>
                <ThemedText type="defaultSemiBold">{formatMoney(cat.amount)}</ThemedText>
              </View>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, `rollover${cat.rolloverMode.charAt(0).toUpperCase()}${cat.rolloverMode.slice(1)}` as TranslationKey)}
              </ThemedText>

              {cat.subcategories.length > 0 && (
                <View
                  style={{
                    gap: spacing.xs,
                    paddingLeft: spacing.md,
                    borderLeftWidth: 2,
                    borderLeftColor: colors.borderLight,
                    marginTop: spacing.xs,
                  }}
                >
                  {cat.subcategories.map((sub, si) => (
                    <View key={si} style={styles.summaryRow}>
                      <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                        {sub.name}
                      </ThemedText>
                      <ThemedText style={[typography.body, { color: colors.textMuted }]}>
                        {formatMoney(sub.amount)}
                      </ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>
        ))}
      </View>

      {/* Deletions warning */}
      {diff.deletes.length > 0 && (
        <Card variant="accent">
          <ThemedText style={[typography.body, { color: colors.error }]}>
            {diff.deletes.length} {t(language, 'categories').toLowerCase()} {t(language, 'delete').toLowerCase()}
          </ThemedText>
        </Card>
      )}

      {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}

      <View style={[styles.summaryRow, { gap: spacing.sm }]}>
        <Button variant="outline" style={{ flex: 1 }} onPress={onBack} disabled={saving}>
          {t(language, 'back')}
        </Button>
        <Button style={{ flex: 1 }} onPress={onFinish} disabled={saving || !state.categories.length}>
          {saving
            ? t(language, 'budgetSetupSaving')
            : state.mode === 'edit'
              ? t(language, 'budgetSetupApply')
              : t(language, 'budgetSetupFinish')}
        </Button>
      </View>
      {saving ? <ActivityIndicator size="small" color={colors.primary} /> : null}
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
