import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/Card';
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
  getBudgetHierarchy,
  getBudgetSettings,
  setCategoryRolloverMode as setLocalRolloverMode,
  updateBudgetSettings,
  upsertBudget as upsertLocalBudget,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

const rolloverModes = ['none', 'positive', 'negative', 'both'] as const;

function ProgressBar({ spent, budget, color, trackColor }: { spent: number; budget: number; color: string; trackColor: string }) {
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const { borderRadius } = useAppTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor, borderRadius: borderRadius.pill }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color, borderRadius: borderRadius.pill }]} />
    </View>
  );
}

export default function BudgetsScreen() {
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [cycleLength, setCycleLength] = React.useState('');
  const [anchorDate, setAnchorDate] = React.useState('');
  const [settingsError, setSettingsError] = React.useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const [rolloverSaving, setRolloverSaving] = React.useState<Record<string, boolean>>({});
  const [rolloverError, setRolloverError] = React.useState<string | null>(null);

  type BudgetsData = {
    periodStart: string;
    items: {
      categoryId: Id<'categories'>;
      name: string;
      amount: number;
      rolloverMode?: typeof rolloverModes[number];
      childTotal: number;
      children: {
        categoryId: Id<'categories'>;
        name: string;
        amount: number;
        rolloverMode?: typeof rolloverModes[number];
      }[];
    }[];
  };
  let data: BudgetsData | undefined;
  let dataError: Error | null = null;
  try {
    data = useQuery(
      api.budgets.getHierarchy,
      owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
    );
  } catch (error) {
    dataError = error as Error;
  }
  const localData = useLocalQuery(getBudgetHierarchy, [], !isSignedIn);
  const localSettings = useLocalQuery(getBudgetSettings, [], !isSignedIn);
  const upsertBudget = useMutation(api.budgets.upsert);
  const settings = useQuery(
    api.budgets.getSettings,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const updateSettings = useMutation(api.budgets.updateSettings);
  const setRolloverMode = useMutation(api.categories.setRolloverMode);

  React.useEffect(() => {
    if (!__DEV__) return;
    console.info('[Budgets]', {
      isReady,
      isSignedIn,
      owner,
      data,
      dataError: dataError?.message,
      localData: localData.data,
      localDataError: localData.error?.message,
      settings,
      localSettings: localSettings.data,
      localSettingsError: localSettings.error?.message,
    });
  }, [
    isReady,
    isSignedIn,
    owner,
    data,
    dataError,
    localData.data,
    localData.error,
    settings,
    localSettings.data,
    localSettings.error,
  ]);

  React.useEffect(() => {
    const source = isSignedIn ? settings : localSettings.data;
    if (!source) return;
    setCycleLength(String(source.cycleLengthDays ?? ''));
    setAnchorDate(source.anchorDate ?? '');
  }, [settings, localSettings.data, isSignedIn]);

  const rolloverLabels = React.useMemo(
    () => ({
      none: t(language, 'rolloverNone'),
      positive: t(language, 'rolloverPositive'),
      negative: t(language, 'rolloverNegative'),
      both: t(language, 'rolloverBoth'),
    }),
    [language]
  );

  const onSave = async (categoryId: Id<'categories'>, amount: string) => {
    if (!owner) return;
    const parsed = Number(amount);
    if (Number.isNaN(parsed)) return;
    if (!isSignedIn) {
      await upsertLocalBudget(categoryId, parsed);
      bumpRefresh();
      return;
    }
    await upsertBudget({
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      categoryId,
      amount: parsed,
    });
  };

  const onSaveSettings = async () => {
    if (!owner) return;
    const parsed = Number(cycleLength);
    if (!Number.isFinite(parsed)) {
      setSettingsError(t(language, 'saveFailed'));
      return;
    }
    setSettingsSaving(true);
    setSettingsError(null);
    try {
      if (!isSignedIn) {
        await updateBudgetSettings(parsed, anchorDate.trim());
        bumpRefresh();
      } else {
        await updateSettings({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          cycleLengthDays: parsed,
          anchorDate: anchorDate.trim(),
        });
      }
    } catch (err: any) {
      setSettingsError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const onSetRollover = async (categoryId: Id<'categories'>, mode: typeof rolloverModes[number]) => {
    if (!owner) return;
    setRolloverSaving((prev) => ({ ...prev, [categoryId]: true }));
    setRolloverError(null);
    try {
      if (!isSignedIn) {
        await setLocalRolloverMode(categoryId, mode);
        bumpRefresh();
      } else {
        await setRolloverMode({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          id: categoryId,
          rolloverMode: mode,
        });
      }
    } catch (err: any) {
      setRolloverError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setRolloverSaving((prev) => ({ ...prev, [categoryId]: false }));
    }
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

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

  const resolvedData = isSignedIn ? data : localData.data;

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'budgets')}</ThemedText>

      {/* Budget Cycle Settings */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'budgetCycle')}
          </ThemedText>
          <View style={[styles.settingsRow, { gap: spacing.sm }]}>
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              keyboardType="numeric"
              value={cycleLength}
              onChangeText={setCycleLength}
              placeholder={t(language, 'cycleLengthDays')}
              placeholderTextColor={colors.textMuted}
            />
            <TextInput
              style={[inputStyle, { flex: 1 }]}
              value={anchorDate}
              onChangeText={setAnchorDate}
              placeholder={t(language, 'anchorDate')}
              placeholderTextColor={colors.textMuted}
            />
            <Button variant="secondary" size="sm" onPress={onSaveSettings} disabled={settingsSaving}>
              {t(language, 'save')}
            </Button>
          </View>
          {settingsError ? <ThemedText style={{ color: colors.error }}>{settingsError}</ThemedText> : null}
          {resolvedData?.periodStart ? (
            <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
              {t(language, 'periodStart')}: {resolvedData.periodStart}
            </ThemedText>
          ) : null}
        </View>
      </Card>

      {/* Budget Items */}
      {(dataError || localData.error) ? (
        <Card>
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>{t(language, 'checkConnection')}</ThemedText>
            {__DEV__ && (dataError?.message || localData.error?.message) ? (
              <ThemedText style={{ color: colors.textMuted }}>{dataError?.message ?? localData.error?.message}</ThemedText>
            ) : null}
          </View>
        </Card>
      ) : !resolvedData ? (
        <Card>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : resolvedData.items.length ? (
        <View style={{ gap: spacing.md }}>
          {rolloverError ? (
            <ThemedText style={{ color: colors.error }}>{rolloverError}</ThemedText>
          ) : null}
          {resolvedData.items.map((item) => {
            const hasChildren = item.children.length > 0;
            const isBalanced = !hasChildren || Math.abs(item.childTotal - item.amount) < 0.01;
            return (
              <Card key={item.categoryId} variant="elevated">
                <View style={{ gap: spacing.md }}>
                  {/* Header */}
                  <View style={styles.itemHeader}>
                    <View style={{ gap: 2, flex: 1 }}>
                      <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {formatMoney(item.amount)}
                      </ThemedText>
                    </View>
                    {hasChildren && !isBalanced && (
                      <View style={[styles.warningBadge, { backgroundColor: colors.error + '18', borderRadius: borderRadius.pill }]}>
                        <ThemedText style={[typography.caption, { color: colors.error }]}>
                          {t(language, 'allocationMismatch')}
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  {/* Allocation bar for parent */}
                  {hasChildren && (
                    <View style={{ gap: spacing.xs }}>
                      <ProgressBar
                        spent={item.childTotal}
                        budget={item.amount}
                        color={isBalanced ? colors.accent : colors.warning}
                        trackColor={colors.accentMuted}
                      />
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {t(language, 'allocatedTotal')}: {formatMoney(item.childTotal)} / {formatMoney(item.amount)}
                      </ThemedText>
                    </View>
                  )}

                  {/* Actions */}
                  {hasChildren ? (
                    <Button variant="secondary" size="sm" onPress={() => router.push({
                      pathname: '/(screens)/budget-allocate/[categoryId]',
                      params: { categoryId: item.categoryId },
                    })}>
                      {t(language, 'allocate')}
                    </Button>
                  ) : (
                    <View style={[styles.settingsRow, { gap: spacing.sm }]}>
                      <TextInput
                        style={[inputStyle, { flex: 1 }]}
                        keyboardType="numeric"
                        value={drafts[item.categoryId] ?? item.amount.toString()}
                        onChangeText={(val) => setDrafts((prev) => ({ ...prev, [item.categoryId]: val }))}
                        placeholderTextColor={colors.textMuted}
                      />
                      <Button variant="secondary" size="sm" onPress={() => onSave(item.categoryId, drafts[item.categoryId] ?? item.amount.toString())}>
                        {t(language, 'save')}
                      </Button>
                    </View>
                  )}

                  {/* Rollover */}
                  <View style={{ gap: spacing.xs }}>
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{t(language, 'rollover')}</ThemedText>
                    <View style={[styles.rolloverRow, { gap: spacing.xs }]}>
                      {rolloverModes.map((mode) => {
                        const isActive = (item.rolloverMode ?? 'none') === mode;
                        return (
                          <Pressable
                            key={mode}
                            onPress={() => onSetRollover(item.categoryId, mode)}
                            disabled={rolloverSaving[item.categoryId]}
                            style={[
                              styles.rolloverPill,
                              { borderRadius: borderRadius.pill, borderColor: colors.borderLight },
                              isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                            ]}
                          >
                            <ThemedText style={[
                              typography.caption,
                              isActive && { fontWeight: '600', color: colors.primary },
                            ]}>
                              {rolloverLabels[mode]}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ) : (
        <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noBudgets')}</ThemedText>
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
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  warningBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    minWidth: 100,
  },
  rolloverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rolloverPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
