import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
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
  ensureHistorySnapshots as ensureLocalHistorySnapshots,
  getBudgetHierarchyWithSpent,
  getBudgetSettings,
  setCategoryCarryoverAdjustment as setLocalCarryoverAdjustment,
  listTransactions as listLocalTransactions,
  updateBudgetSettings,
  createCategory as createLocalCategory,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

/* ---------- tiny helpers ---------- */

function pct(spent: number, budget: number) {
  if (budget <= 0) return 0;
  return Math.min(spent / budget, 1);
}

/* ---------- sub-components ---------- */

function ProgressBar({
  ratio,
  color,
  trackColor,
}: {
  ratio: number;
  color: string;
  trackColor: string;
}) {
  const { borderRadius } = useAppTheme();
  return (
    <View
      style={[
        styles.progressTrack,
        { backgroundColor: trackColor, borderRadius: borderRadius.pill },
      ]}
    >
      <View
        style={[
          styles.progressFill,
          {
            width: `${Math.min(ratio, 1) * 100}%`,
            backgroundColor: color,
            borderRadius: borderRadius.pill,
          },
        ]}
      />
    </View>
  );
}

type TransactionItem = { _id: string; name: string; date: string; amount: number };

function CategoryTransactions({
  categoryId,
  periodStart,
  periodEnd,
  isSignedIn,
}: {
  categoryId: string;
  periodStart: string;
  periodEnd: string;
  isSignedIn: boolean;
}) {
  const { owner } = useIdentity();
  const { colors, typography } = useAppTheme();

  const convexData = useQuery(
    api.transactions.list,
    owner && isSignedIn
      ? {
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          categoryId: categoryId as Id<'categories'>,
          startDate: periodStart,
          endDate: periodEnd,
          limit: 50,
        }
      : 'skip'
  );

  const localData = useLocalQuery(
    () =>
      listLocalTransactions({
        categoryId,
        startDate: periodStart,
        endDate: periodEnd,
        limit: 50,
      }),
    [categoryId, periodStart, periodEnd],
    !isSignedIn
  );

  const items: TransactionItem[] = isSignedIn
    ? (convexData?.items as TransactionItem[] | undefined) ?? []
    : (localData.data?.items as TransactionItem[] | undefined) ?? [];

  if (!items.length) return null;

  return (
    <>
      {items.map((tx) => {
        const amt = tx.amount;
        const isDebit = amt > 0;
        return (
          <View key={tx._id} style={styles.ledgerRow}>
            <ThemedText style={[typography.caption, { flex: 1 }]} numberOfLines={1}>
              {tx.name}
            </ThemedText>
            <ThemedText
              style={[
                typography.caption,
                { color: isDebit ? colors.error : colors.success },
              ]}
            >
              {isDebit ? `−${formatMoney(amt)}` : formatMoney(Math.abs(amt))}
            </ThemedText>
          </View>
        );
      })}
    </>
  );
}

/* ---------- main screen ---------- */

export default function BudgetsScreen() {
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();

  /* ---- data ---- */
  let data: any;
  let dataError: Error | null = null;
  try {
    data = useQuery(
      api.budgets.getFullHierarchy,
      owner && isSignedIn
        ? { ownerType: owner.ownerType, ownerId: owner.ownerId }
        : 'skip'
    );
  } catch (error) {
    dataError = error as Error;
  }

  const localData = useLocalQuery(getBudgetHierarchyWithSpent, [], !isSignedIn);
  const localSettings = useLocalQuery(getBudgetSettings, [], !isSignedIn);
  const settings = useQuery(
    api.budgets.getSettings,
    owner && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId }
      : 'skip'
  );

  const updateSettings = useMutation(api.budgets.updateSettings);
  const setCarryoverAdjustment = useMutation(api.categories.setCarryoverAdjustment);
  const createCategory = useMutation(api.categories.create);
  const ensureRemoteSnapshots = useMutation(api.history.ensureSnapshots);

  const resolvedData = isSignedIn ? data : localData.data;
  const resolvedSettings = isSignedIn ? settings : localSettings.data;

  /* ---- local state ---- */
  const [editingIncome, setEditingIncome] = React.useState(false);
  const [incomeDraft, setIncomeDraft] = React.useState('');
  const [carryoverDrafts, setCarryoverDrafts] = React.useState<Record<string, string>>({});
  const [editingCarryover, setEditingCarryover] = React.useState<Record<string, boolean>>({});
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [savingStates, setSavingStates] = React.useState<Record<string, boolean>>({});

  /* ---- derived ---- */
  useLocalQuery(ensureLocalHistorySnapshots, [], !isSignedIn);

  React.useEffect(() => {
    if (!owner || !isSignedIn) return;
    ensureRemoteSnapshots({ ownerType: owner.ownerType, ownerId: owner.ownerId }).catch(() => undefined);
    return;
  }, [owner, isSignedIn, ensureRemoteSnapshots]);

  const monthlyIncome = resolvedData?.monthlyIncome ?? (resolvedSettings as any)?.monthlyIncome ?? 0;
  const items: any[] = resolvedData?.items ?? [];
  const totalAllocated = items.reduce((sum: number, item: any) => sum + (item.amount as number), 0);
  const totalSpent = items.reduce((sum: number, item: any) => sum + (item.spent as number), 0);
  const incomeTotal = resolvedData?.incomeTotal ?? 0;
  const periodStart: string = resolvedData?.periodStart ?? '';
  const periodEnd: string = resolvedData?.periodEnd ?? '';

  /* ---- handlers ---- */
  const onSaveIncome = async () => {
    if (!owner) return;
    const parsed = Number(incomeDraft);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    const source = resolvedSettings;
    const cycle = source?.cycleLengthDays ?? 30;
    const anchor = source?.anchorDate ?? new Date().toISOString().slice(0, 10);
    try {
      if (!isSignedIn) {
        await updateBudgetSettings(cycle, anchor, parsed);
        bumpRefresh();
      } else {
        await updateSettings({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          cycleLengthDays: cycle,
          anchorDate: anchor,
          monthlyIncome: parsed,
        });
      }
    } finally {
      setEditingIncome(false);
    }
  };

  const onSaveCarryover = async (
    categoryId: string,
    raw: string,
    carryoverBase: number
  ) => {
    if (!owner) return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const adjustment = parsed - carryoverBase;
    setSavingStates((s) => ({ ...s, [categoryId]: true }));
    try {
      if (!isSignedIn) {
        await setLocalCarryoverAdjustment(categoryId, adjustment);
        bumpRefresh();
      } else {
        await setCarryoverAdjustment({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          id: categoryId as Id<'categories'>,
          carryoverAdjustment: adjustment,
        });
      }
    } finally {
      setSavingStates((s) => ({ ...s, [categoryId]: false }));
    }
  };

  const onAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || !owner) return;
    setAddingCategory(true);
    try {
      if (!isSignedIn) {
        await createLocalCategory(name, null, 'expense');
        bumpRefresh();
      } else {
        await createCategory({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          name,
          categoryKind: 'expense',
        });
      }
      setNewCategoryName('');
    } finally {
      setAddingCategory(false);
    }
  };

  /* ---- render ---- */
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

  return (
    <ScreenScrollView edges={['top']}
      contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText type="title">{t(language, 'budgets')}</ThemedText>
        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.push({
            pathname: '/(screens)/budget-setup',
            params: { mode: 'edit' },
          })}
        >
          {t(language, 'editBudget')}
        </Button>
      </View>

      {/* Error state */}
      {(dataError || localData.error) ? (
        <Card>
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>
              {t(language, 'checkConnection')}
            </ThemedText>
          </View>
        </Card>
      ) : !resolvedData ? (
        <Card>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : items.length === 0 ? (
        /* Empty state */
        <Card>
          <View style={{ gap: spacing.sm }}>
            <ThemedText type="defaultSemiBold">
              {t(language, 'budgetSetupEmptyTitle')}
            </ThemedText>
            <ThemedText style={{ color: colors.textMuted }}>
              {t(language, 'budgetSetupEmptySubtitle')}
            </ThemedText>
            <Button onPress={() => router.push('/(screens)/budget-setup')}>
              {t(language, 'budgetSetupStart')}
            </Button>
          </View>
        </Card>
      ) : (
        <>
          {/* Income Card */}
          <Card>
            <View
              style={{
                gap: spacing.xs,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <ThemedText
                style={[
                  typography.label,
                  {
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  },
                ]}
              >
                {t(language, 'monthlyIncome')}
              </ThemedText>
              {!editingIncome && (
                <Pressable
                  onPress={() => {
                    setIncomeDraft(monthlyIncome > 0 ? String(monthlyIncome) : '');
                    setEditingIncome(true);
                  }}
                  style={{ padding: 4 }}
                >
                  <ThemedText style={[typography.caption, { color: colors.primary }]}>
                    {t(language, 'edit')}
                  </ThemedText>
                </Pressable>
              )}
            </View>
            {editingIncome ? (
              <View style={[styles.row, { gap: spacing.sm }]}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  keyboardType="numeric"
                  value={incomeDraft}
                  onChangeText={setIncomeDraft}
                  autoFocus
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
                <Button variant="secondary" size="sm" onPress={onSaveIncome}>
                  {t(language, 'save')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => setEditingIncome(false)}
                >
                  {t(language, 'cancel')}
                </Button>
              </View>
            ) : (
              <ThemedText type="title" style={{ fontSize: 28, marginTop: spacing.xs }}>
                {monthlyIncome > 0
                  ? formatMoney(monthlyIncome)
                  : t(language, 'incomeNotSet')}
              </ThemedText>
            )}
          </Card>

          {/* Summary Card */}
          <Card variant="muted">
            <View style={{ gap: spacing.sm }}>
              <View style={styles.summaryRow}>
                <ThemedText type="defaultSemiBold">
                  {t(language, 'totalAllocated')}
                </ThemedText>
                <ThemedText type="defaultSemiBold">
                  {formatMoney(totalAllocated)}
                </ThemedText>
              </View>
              {monthlyIncome > 0 && (
                <ProgressBar
                  ratio={pct(totalAllocated, monthlyIncome)}
                  color={
                    totalAllocated > monthlyIncome ? colors.error : colors.primary
                  }
                  trackColor={colors.primaryMuted}
                />
              )}
              <View style={styles.summaryRow}>
                <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                  {t(language, 'totalSpent')}
                </ThemedText>
                <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                  {formatMoney(totalSpent)}
                </ThemedText>
              </View>
              {incomeTotal > 0 ? (
                <View style={styles.summaryRow}>
                  <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                    {t(language, 'monthlyIncome')}
                  </ThemedText>
                  <ThemedText style={[typography.caption, { color: colors.success }]}>
                    {formatMoney(incomeTotal)}
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.summaryRow}>
                <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                  {t(language, 'remainingBudget')}
                </ThemedText>
                <ThemedText
                  style={[
                    typography.caption,
                    {
                      color:
                        totalAllocated - totalSpent < 0
                          ? colors.error
                          : colors.success,
                    },
                  ]}
                >
                  {formatMoney(totalAllocated - totalSpent)}
                </ThemedText>
              </View>
            </View>
          </Card>

          {/* Category list */}
          <View style={{ gap: spacing.md }}>
            {items.map((item: any) => {
              const key = String(item.categoryId);
              const spent = item.spent ?? 0;
              const budget = item.amount ?? 0;
              const ratio = pct(spent, budget);
              const over = spent > budget && budget > 0;
              const saving = savingStates[key] ?? false;
              const carryoverBase = item.carryoverBase ?? 0;
              const carryoverCurrent = item.carryoverCurrent ?? 0;
              const carryoverAdjustment = item.carryoverAdjustment ?? 0;
              const showCarryover =
                item.rolloverMode !== 'none' ||
                Math.abs(carryoverCurrent) > 0.005 ||
                Math.abs(carryoverAdjustment) > 0.005;
              const ledgerTotal = budget + carryoverCurrent - spent;
              const isEditingCarryover = editingCarryover[key] ?? false;

              return (
                <Card key={key}>
                  <View style={{ gap: spacing.sm }}>
                    {/* Category header */}
                    <View style={styles.summaryRow}>
                      <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                      <ThemedText
                        style={[
                          typography.caption,
                          { color: over ? colors.error : colors.textMuted },
                        ]}
                      >
                        {formatMoney(spent)} / {formatMoney(budget)}
                      </ThemedText>
                    </View>

                    <ProgressBar
                      ratio={ratio}
                      color={over ? colors.error : colors.accent}
                      trackColor={colors.accentMuted}
                    />

                    {/* Ledger rows */}
                    <View style={{ gap: 0 }}>
                      {/* This month's budget (credit) */}
                      {budget > 0 && (
                        <View style={styles.ledgerRow}>
                          <ThemedText style={typography.caption}>
                            {t(language, 'thisMonthBudget')}
                          </ThemedText>
                          <ThemedText style={[typography.caption, { color: colors.success }]}>
                            {formatMoney(budget)}
                          </ThemedText>
                        </View>
                      )}

                      {/* Carryover from last month */}
                      {showCarryover && (
                        isEditingCarryover ? (
                          <View style={[styles.ledgerRow, { gap: spacing.sm }]}>
                            <ThemedText style={[typography.caption, { flex: 1 }]}>
                              {t(language, 'carryoverFromLast')}
                            </ThemedText>
                            <TextInput
                              style={[
                                styles.inlineInput,
                                {
                                  borderRadius: borderRadius.sm,
                                  borderColor: colors.borderLight,
                                  color: colors.text,
                                  backgroundColor: colors.backgroundCard,
                                  fontFamily: typography.caption.fontFamily,
                                  fontSize: typography.caption.fontSize,
                                },
                              ]}
                              keyboardType="numeric"
                              value={carryoverDrafts[key] ?? String(carryoverCurrent)}
                              onChangeText={(v) =>
                                setCarryoverDrafts((d) => ({ ...d, [key]: v }))
                              }
                              autoFocus
                            />
                            <Pressable
                              disabled={saving}
                              onPress={async () => {
                                await onSaveCarryover(
                                  key,
                                  carryoverDrafts[key] ?? String(carryoverCurrent),
                                  carryoverBase
                                );
                                setEditingCarryover((p) => ({ ...p, [key]: false }));
                              }}
                            >
                              <ThemedText style={[typography.caption, { color: colors.primary }]}>
                                {t(language, 'save')}
                              </ThemedText>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                setEditingCarryover((p) => ({ ...p, [key]: false }))
                              }
                            >
                              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                                {t(language, 'cancel')}
                              </ThemedText>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            style={styles.ledgerRow}
                            onPress={() => {
                              setCarryoverDrafts((d) => ({
                                ...d,
                                [key]: String(carryoverCurrent),
                              }));
                              setEditingCarryover((p) => ({ ...p, [key]: true }));
                            }}
                          >
                            <ThemedText style={typography.caption}>
                              {t(language, 'carryoverFromLast')}
                            </ThemedText>
                            <ThemedText
                              style={[
                                typography.caption,
                                {
                                  color:
                                    carryoverCurrent < 0
                                      ? colors.error
                                      : colors.success,
                                },
                              ]}
                            >
                              {carryoverCurrent < 0
                                ? `−${formatMoney(Math.abs(carryoverCurrent))}`
                                : formatMoney(carryoverCurrent)}
                            </ThemedText>
                          </Pressable>
                        )
                      )}

                      {/* Divider before transactions */}
                      <View
                        style={{
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.borderLight,
                          marginVertical: spacing.xs,
                        }}
                      />

                      {/* Transaction line items */}
                      {periodStart && periodEnd && (
                        <CategoryTransactions
                          categoryId={key}
                          periodStart={periodStart}
                          periodEnd={periodEnd}
                          isSignedIn={isSignedIn}
                        />
                      )}

                      {/* Subcategory spending as line items */}
                      {item.children?.length > 0 &&
                        item.children.map((child: any) => {
                          const childSpent = child.spent ?? 0;
                          if (childSpent <= 0) return null;
                          return (
                            <View key={String(child.categoryId)} style={styles.ledgerRow}>
                              <ThemedText
                                style={[typography.caption, { flex: 1, paddingLeft: spacing.sm }]}
                                numberOfLines={1}
                              >
                                {child.name}
                              </ThemedText>
                              <ThemedText style={[typography.caption, { color: colors.error }]}>
                                −{formatMoney(childSpent)}
                              </ThemedText>
                            </View>
                          );
                        })}

                      {/* Divider before total */}
                      <View
                        style={{
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.borderLight,
                          marginVertical: spacing.xs,
                        }}
                      />

                      {/* Total row */}
                      <View style={styles.ledgerRow}>
                        <ThemedText style={typography.bodySemiBold}>
                          {t(language, 'total')}
                        </ThemedText>
                        <ThemedText
                          style={[
                            typography.bodySemiBold,
                            {
                              color: ledgerTotal < 0 ? colors.error : colors.success,
                            },
                          ]}
                        >
                          {ledgerTotal < 0
                            ? `−${formatMoney(Math.abs(ledgerTotal))}`
                            : formatMoney(ledgerTotal)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </Card>
              );
            })}

            {/* Add category inline */}
            <Card>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder={t(language, 'addCategoryInline')}
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={onAddCategory}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={onAddCategory}
                  disabled={addingCategory || !newCategoryName.trim()}
                >
                  {t(language, 'addCategoryInline')}
                </Button>
              </View>
            </Card>
          </View>
        </>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ledgerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  inlineInput: {
    height: 28,
    borderWidth: 1,
    paddingHorizontal: 8,
    width: 80,
    textAlign: 'right',
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
    minWidth: 80,
  },
  progressTrack: {
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
