import React from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
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
import { getPeriodForOffset } from '@/lib/budgetPeriods';
import { formatMoney } from '@/lib/money';
import {
  addManualHistoryCycle as addLocalManualHistoryCycle,
  ensureHistorySnapshots as ensureLocalHistorySnapshots,
  getBudgetHierarchyWithSpent,
  getBudgetSettings,
  getCategories,
  getHistoryCycleDetails,
  listHistoryCycles,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

function formatPeriod(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
}

export default function HistoryScreen() {
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, typography, borderRadius } = useAppTheme();
  const [expandedPeriodStart, setExpandedPeriodStart] = React.useState<string | null>(null);
  const [syncingRemote, setSyncingRemote] = React.useState(false);
  const [cycleLimit, setCycleLimit] = React.useState(24);
  const [loadingMoreHistory, setLoadingMoreHistory] = React.useState(false);
  const [showManualForm, setShowManualForm] = React.useState(false);
  const [manualPeriodStart, setManualPeriodStart] = React.useState('');
  const [manualSpentDrafts, setManualSpentDrafts] = React.useState<Record<string, string>>({});
  const [savingManualHistory, setSavingManualHistory] = React.useState(false);

  const ensureRemoteSnapshots = useMutation(api.history.ensureSnapshots);
  const addManualRemoteCycle = useMutation(api.history.addManualCycle);
  const remoteSettings = useQuery(
    api.budgets.getSettings,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const remoteCategories = useQuery(
    api.categories.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const remoteHierarchy = useQuery(
    api.budgets.getFullHierarchy,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );

  React.useEffect(() => {
    let cancelled = false;
    if (!owner || !isSignedIn) return;
    setSyncingRemote(true);
    ensureRemoteSnapshots({ ownerType: owner.ownerType, ownerId: owner.ownerId })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setSyncingRemote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, isSignedIn, ensureRemoteSnapshots]);

  const remoteCycles = useQuery(
    api.history.listCycles,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId, limit: cycleLimit } : 'skip'
  );
  const remoteDetails = useQuery(
    api.history.getCycleDetails,
    owner && isSignedIn && expandedPeriodStart
      ? {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          periodStart: expandedPeriodStart,
        }
      : 'skip'
  );

  useLocalQuery(ensureLocalHistorySnapshots, [], !isSignedIn);
  const localSettings = useLocalQuery(getBudgetSettings, [], !isSignedIn);
  const localCategories = useLocalQuery(getCategories, [], !isSignedIn);
  const localHierarchy = useLocalQuery(getBudgetHierarchyWithSpent, [], !isSignedIn);
  const localCycles = useLocalQuery(() => listHistoryCycles({ limit: cycleLimit }), [cycleLimit], !isSignedIn);
  const localDetails = useLocalQuery(
    () => (expandedPeriodStart ? getHistoryCycleDetails(expandedPeriodStart) : Promise.resolve({ cycle: null, categories: [] })),
    [expandedPeriodStart],
    !isSignedIn && Boolean(expandedPeriodStart)
  );

  const activeCycles = isSignedIn ? remoteCycles : localCycles.data;
  const activeDetails = isSignedIn ? remoteDetails : localDetails.data;
  const activeCategories = (isSignedIn ? remoteCategories : localCategories.data) as
    | Array<{ _id: string; name?: string; label?: string; categoryKind?: string }>
    | undefined;
  const activeHierarchy = (isSignedIn ? remoteHierarchy : localHierarchy.data) as
    | {
        items: Array<{
          categoryId: string;
          amount?: number;
          children?: Array<{ categoryId: string; amount?: number }>;
        }>;
      }
    | undefined;
  const activeSettings = (isSignedIn ? remoteSettings : localSettings.data) as
    | { anchorDate: string; cycleLengthDays: number }
    | undefined;
  const expenseCategories = React.useMemo(
    () =>
      (Array.isArray(activeCategories) ? activeCategories : [])
        .filter((category) => category.categoryKind === 'expense')
        .sort((a, b) => (a.name ?? a.label ?? '').localeCompare(b.name ?? b.label ?? '')),
    [activeCategories]
  );
  const budgetBaseByCategory = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of activeHierarchy?.items ?? []) {
      map.set(String(item.categoryId), Number(item.amount ?? 0));
      for (const child of item.children ?? []) {
        map.set(String(child.categoryId), Number(child.amount ?? 0));
      }
    }
    return map;
  }, [activeHierarchy]);
  const hasMoreHistory = Boolean(activeCycles?.nextCursor);

  React.useEffect(() => {
    if (activeCycles) {
      setLoadingMoreHistory(false);
    }
  }, [activeCycles]);

  const onLoadMoreHistory = React.useCallback(() => {
    if (loadingMoreHistory || !hasMoreHistory) return;
    setLoadingMoreHistory(true);
    setCycleLimit((current) => Math.min(current + 24, 120));
  }, [loadingMoreHistory, hasMoreHistory]);

  const openManualForm = React.useCallback(() => {
    if (!activeSettings || expenseCategories.length === 0) return;
    const currentPeriodStart = getPeriodForOffset(
      activeSettings.anchorDate,
      activeSettings.cycleLengthDays,
      new Date(),
      0
    ).periodStart;
    const earliestKnownStart =
      activeCycles?.items?.[activeCycles.items.length - 1]?.periodStart ?? currentPeriodStart;
    const suggestedPeriodStart = getPeriodForOffset(
      activeSettings.anchorDate,
      activeSettings.cycleLengthDays,
      new Date(earliestKnownStart),
      -1
    ).periodStart;
    const initialDrafts: Record<string, string> = {};
    for (const category of expenseCategories) initialDrafts[String(category._id)] = '';
    setManualSpentDrafts(initialDrafts);
    setManualPeriodStart(suggestedPeriodStart);
    setShowManualForm(true);
  }, [activeSettings, expenseCategories, activeCycles]);

  const onSaveManualHistory = React.useCallback(async () => {
    if (!owner || !activeSettings || savingManualHistory) return;
    if (!manualPeriodStart) {
      Alert.alert(t(language, 'saveFailed'), t(language, 'invalidDate'));
      return;
    }
    const earliestKnownStart = activeCycles?.items?.[activeCycles.items.length - 1]?.periodStart;
    if (earliestKnownStart && manualPeriodStart >= earliestKnownStart) {
      Alert.alert(t(language, 'saveFailed'), t(language, 'addHistoryMustBeBeforeExisting'));
      return;
    }
    const entries = expenseCategories.map((category) => {
      const raw = manualSpentDrafts[String(category._id)] ?? '';
      const spent = raw.trim().length ? Number(raw) : 0;
      return { categoryId: String(category._id), spent };
    });
    if (entries.some((entry) => !Number.isFinite(entry.spent) || entry.spent < 0)) {
      Alert.alert(t(language, 'saveFailed'), t(language, 'invalidAmount'));
      return;
    }

    setSavingManualHistory(true);
    try {
      if (isSignedIn) {
        await addManualRemoteCycle({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          periodStart: manualPeriodStart,
          entries: entries.map((entry) => ({
            categoryId: entry.categoryId as Id<'categories'>,
            spent: entry.spent,
          })),
        });
      } else {
        await addLocalManualHistoryCycle(manualPeriodStart, entries);
        bumpRefresh();
      }
      setShowManualForm(false);
      setManualSpentDrafts({});
    } catch (error: any) {
      Alert.alert(t(language, 'saveFailed'), error?.message ?? t(language, 'saveFailed'));
    } finally {
      setSavingManualHistory(false);
    }
  }, [
    owner,
    activeSettings,
    savingManualHistory,
    manualPeriodStart,
    activeCycles,
    expenseCategories,
    manualSpentDrafts,
    language,
    isSignedIn,
    addManualRemoteCycle,
    bumpRefresh,
  ]);

  if (!isReady) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const latest = activeCycles?.items?.[0];

  return (
    <ScreenScrollView
      edges={['top']}
      contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}
    >
      <View style={styles.headerRow}>
        <ThemedText type="title">{t(language, 'history')}</ThemedText>
        {syncingRemote ? (
          <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
            {t(language, 'syncingHistory')}
          </ThemedText>
        ) : null}
      </View>
      <Button onPress={openManualForm} variant="outline" size="sm" disabled={!activeSettings || expenseCategories.length === 0}>
        {t(language, 'addHistory')}
      </Button>

      {showManualForm ? (
        <Card>
          <View style={{ gap: spacing.sm }}>
            <ThemedText type="defaultSemiBold">{t(language, 'addHistory')}</ThemedText>
            <TextInput
              value={manualPeriodStart}
              onChangeText={setManualPeriodStart}
              placeholder={t(language, 'anchorDate')}
              autoCapitalize="none"
              style={[
                styles.input,
                {
                  borderColor: colors.borderLight,
                  color: colors.text,
                },
              ]}
              placeholderTextColor={colors.textMuted}
            />
            {expenseCategories.map((category) => {
              const categoryId = String(category._id);
              const categoryName = category.name ?? category.label ?? 'Category';
              return (
                <View key={categoryId} style={{ gap: 4 }}>
                  <ThemedText style={typography.caption}>
                    {categoryName} ({t(language, 'budgetBase')}: {formatMoney(budgetBaseByCategory.get(categoryId) ?? 0)})
                  </ThemedText>
                  <TextInput
                    value={manualSpentDrafts[categoryId] ?? ''}
                    onChangeText={(text) =>
                      setManualSpentDrafts((prev) => ({
                        ...prev,
                        [categoryId]: text,
                      }))
                    }
                    placeholder={t(language, 'spent')}
                    keyboardType="decimal-pad"
                    style={[
                      styles.input,
                      {
                        borderColor: colors.borderLight,
                        color: colors.text,
                      },
                    ]}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              );
            })}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button onPress={onSaveManualHistory} disabled={savingManualHistory}>
                {savingManualHistory ? t(language, 'saving') : t(language, 'save')}
              </Button>
              <Button
                onPress={() => setShowManualForm(false)}
                variant="secondary"
                disabled={savingManualHistory}
              >
                {t(language, 'cancel')}
              </Button>
            </View>
          </View>
        </Card>
      ) : null}

      {latest ? (
        <Card variant="elevated">
          <View style={{ gap: spacing.sm }}>
            <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase' }]}>
              {t(language, 'cycle')}
            </ThemedText>
            <ThemedText style={typography.bodySemiBold}>{formatPeriod(latest.periodStart, latest.periodEnd)}</ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, 'overUnderBase')}
              </ThemedText>
              <ThemedText
                style={[
                  typography.bodySemiBold,
                  { color: latest.overUnderBase < 0 ? colors.error : colors.success },
                ]}
              >
                {formatMoney(latest.overUnderBase)}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, 'carryoverNet')}
              </ThemedText>
              <ThemedText style={typography.bodySemiBold}>{formatMoney(latest.carryoverNetTotal)}</ThemedText>
            </View>
          </View>
        </Card>
      ) : null}

      {!activeCycles ? (
        <Card>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : activeCycles.items.length === 0 ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noHistory')}</ThemedText>
            <Button onPress={openManualForm} disabled={!activeSettings || expenseCategories.length === 0} variant="secondary">
              {t(language, 'addHistory')}
            </Button>
          </View>
        </Card>
      ) : (
        <View style={{ gap: spacing.md }}>
          <ThemedText type="subtitle">{t(language, 'cycleHistory')}</ThemedText>
          {activeCycles.items.map((cycle) => {
            const expanded = expandedPeriodStart === cycle.periodStart;
            return (
              <Card key={cycle.periodStart}>
                <Pressable
                  onPress={() => setExpandedPeriodStart(expanded ? null : cycle.periodStart)}
                  style={styles.summaryRow}
                >
                  <View style={{ flex: 1 }}>
                    <ThemedText type="defaultSemiBold">
                      {formatPeriod(cycle.periodStart, cycle.periodEnd)}
                    </ThemedText>
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {t(language, 'budgetBase')}: {formatMoney(cycle.totalBudgetBase)} · {t(language, 'spentTotal')}:{' '}
                      {formatMoney(cycle.totalSpent)}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText
                      style={[
                        typography.bodySemiBold,
                        { color: cycle.overUnderBase < 0 ? colors.error : colors.success },
                      ]}
                    >
                      {formatMoney(cycle.overUnderBase)}
                    </ThemedText>
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {expanded ? '▾' : '▸'}
                    </ThemedText>
                  </View>
                </Pressable>

                {expanded ? (
                  <View
                    style={{
                      marginTop: spacing.sm,
                      paddingTop: spacing.sm,
                      paddingLeft: spacing.md,
                      borderTopWidth: 1,
                      borderTopColor: colors.borderLight,
                      borderLeftWidth: 2,
                      borderLeftColor: colors.borderLight,
                      gap: spacing.sm,
                      borderRadius: borderRadius.sm,
                    }}
                  >
                    <View style={styles.summaryRow}>
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {t(language, 'carryoverPositive')}
                      </ThemedText>
                      <ThemedText style={[typography.caption, { color: colors.success }]}>
                        {formatMoney(cycle.carryoverPositiveTotal)}
                      </ThemedText>
                    </View>
                    <View style={styles.summaryRow}>
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                        {t(language, 'carryoverNegative')}
                      </ThemedText>
                      <ThemedText style={[typography.caption, { color: colors.error }]}>
                        {formatMoney(cycle.carryoverNegativeTotal)}
                      </ThemedText>
                    </View>
                    {(activeDetails?.categories ?? []).map((category: any) => (
                      <View key={String(category.categoryId)} style={styles.summaryRow}>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={typography.body}>{category.categoryName}</ThemedText>
                          <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                            {t(language, 'budgetBase')}: {formatMoney(category.budgetBase)} · {t(language, 'spent')}:{' '}
                            {formatMoney(category.spent)}
                          </ThemedText>
                        </View>
                        <ThemedText
                          style={[
                            typography.caption,
                            { color: category.carryoverRunningTotal < 0 ? colors.error : colors.success },
                          ]}
                        >
                          {formatMoney(category.carryoverRunningTotal)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Card>
            );
          })}
          {hasMoreHistory ? (
            <Pressable
              onPress={onLoadMoreHistory}
              style={[
                styles.loadMoreButton,
                {
                  borderColor: colors.borderLight,
                  backgroundColor: colors.backgroundCard,
                },
              ]}
            >
              {loadingMoreHistory ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <ThemedText style={typography.bodySemiBold}>{t(language, 'loadPreviousHistory')}</ThemedText>
              )}
            </Pressable>
          ) : null}
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  loadMoreButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
