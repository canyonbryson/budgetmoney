import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useQuery, useAction, useMutation } from 'convex/react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import { getMonthSummary, listTransactions } from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

/* ───────────────── Shared tiny components ───────────────── */

function ProgressBar({
  spent,
  budget,
  color,
  trackColor,
  height = 8,
}: {
  spent: number;
  budget: number;
  color: string;
  trackColor: string;
  height?: number;
}) {
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const { borderRadius } = useAppTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor, borderRadius: borderRadius.pill, height }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color, borderRadius: borderRadius.pill }]} />
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  const { colors, typography } = useAppTheme();
  return (
    <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 }]}>
      {children}
    </ThemedText>
  );
}

/* ───────────────── Types ───────────────── */

type CategorySummary = {
  categoryId: Id<'categories'>;
  parentId: Id<'categories'> | null;
  name?: string | null;
  icon?: string | null;
  color?: string | null;
  spent: number;
  budgetAmount: number;
  remaining: number;
  overBudget: boolean;
};

type SummaryData = {
  totalSpent: number;
  incomeTotal?: number;
  totalBudget: number;
  periodStart?: string;
  periodEnd?: string;
  uncategorizedCount?: number;
  uncategorizedAmount?: number;
  lastSyncAt?: number;
  categories?: CategorySummary[];
};

type RecentData = {
  items: { _id: Id<'transactions'>; name: string; amount: number }[];
};

/* ───────────────── Hierarchy helper ───────────────── */

type CategoryGroup = {
  parent: CategorySummary;
  children: CategorySummary[];
  /** Aggregate spent across children (or just parent if no children) */
  totalSpent: number;
  totalBudget: number;
};

function buildCategoryGroups(categories: CategorySummary[]): CategoryGroup[] {
  const parents = categories.filter((c) => !c.parentId);
  const childMap = new Map<string, CategorySummary[]>();

  for (const cat of categories) {
    if (cat.parentId) {
      const key = String(cat.parentId);
      if (!childMap.has(key)) childMap.set(key, []);
      childMap.get(key)!.push(cat);
    }
  }

  return parents.map((parent) => {
    const children = childMap.get(String(parent.categoryId)) ?? [];
    const hasChildren = children.length > 0;
    return {
      parent,
      children,
      totalSpent: hasChildren ? children.reduce((s, c) => s + c.spent, 0) : parent.spent,
      totalBudget: hasChildren ? children.reduce((s, c) => s + c.budgetAmount, 0) : parent.budgetAmount,
    };
  });
}

/* ───────────────── Main screen ───────────────── */

export default function DashboardScreen() {
  const { language } = useSettings();
  const { owner, entitlements, isReady, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const [uploading, setUploading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState<{
    tone: 'success' | 'partial' | 'failed';
    text: string;
  } | null>(null);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ── Data ── */

  let summary: SummaryData | undefined;
  let summaryError: Error | null = null;
  try {
    summary = useQuery(
      api.dashboard.getMonthSummary,
      owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
    );
  } catch (error) {
    summaryError = error as Error;
  }
  const localSummary = useLocalQuery(getMonthSummary, [], !isSignedIn);

  let recent: RecentData | undefined;
  let recentError: Error | null = null;
  try {
    recent = useQuery(
      api.transactions.list,
      owner && isSignedIn
        ? { ownerType: owner.ownerType, ownerId: owner.ownerId, limit: 6 }
        : 'skip'
    );
  } catch (error) {
    recentError = error as Error;
  }
  const localRecent = useLocalQuery(() => listTransactions({ limit: 6 }), [], !isSignedIn);

  const syncNow = useAction(api.plaid.syncNow);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const createFromUpload = useMutation(api.receipts.createFromUpload);
  const parseReceipt = useAction(api.receipts.parse);

  const alerts = useQuery(
    api.notifications.getAlerts,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const netWorth = useQuery(
    api.netWorth.getSummary,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );

  React.useEffect(() => {
    if (!__DEV__) return;
    console.info('[Dashboard]', {
      isReady, isSignedIn, owner, summary,
      summaryError: summaryError?.message,
      localSummary: localSummary.data,
      localSummaryError: localSummary.error?.message,
      recent, recentError: recentError?.message,
      localRecent: localRecent.data,
      localRecentError: localRecent.error?.message,
      alerts,
    });
  }, [
    isReady, isSignedIn, owner, summary, summaryError,
    localSummary.data, localSummary.error,
    recent, recentError, localRecent.data, localRecent.error,
    alerts,
  ]);

  /* ── Actions ── */

  const onSync = async () => {
    if (!owner || !isSignedIn) return;
    setSyncing(true);
    setSyncStatus(null);
    try {
      const result = await syncNow({ ownerType: owner.ownerType, ownerId: owner.ownerId });
      if (result?.status === 'ok') {
        setSyncStatus({ tone: 'success', text: 'Sync complete.' });
      } else if (result?.status === 'partial') {
        setSyncStatus({ tone: 'partial', text: 'Sync completed with some failures.' });
      } else {
        setSyncStatus({ tone: 'failed', text: result?.message ?? 'Sync failed.' });
      }
    } catch (err: any) {
      setSyncStatus({ tone: 'failed', text: err?.message ?? 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const onScanReceipt = async () => {
    if (!owner || !entitlements.canUseAi) return;
    setUploading(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const uploadUrl = await generateUploadUrl({ ownerType: owner.ownerType, ownerId: owner.ownerId });
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob,
      });
      if (!uploadResponse.ok) throw new Error('Upload failed');
      const { storageId } = await uploadResponse.json();
      const receiptId = await createFromUpload({ ownerType: owner.ownerType, ownerId: owner.ownerId, storageId });
      await parseReceipt({ ownerType: owner.ownerType, ownerId: owner.ownerId, receiptId });
    } finally {
      setUploading(false);
    }
  };

  /* ── Loading state ── */

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  /* ── Derived values ── */

  const receiptReviewCount = alerts?.receipts?.reviewItemCount ?? 0;
  const receiptCount = alerts?.receipts?.reviewReceiptCount ?? 0;
  const creditDueCount = alerts?.creditDue?.upcoming?.length ?? 0;
  const budgetAlertCount = alerts?.budget?.overBudget?.length ?? 0;
  const weeklyOver =
    alerts?.weeklySummary?.enabled &&
    alerts.weeklySummary.planned > 0 &&
    alerts.weeklySummary.actual > alerts.weeklySummary.planned;
  const monthlyOver =
    alerts?.monthlySummary?.enabled &&
    alerts.monthlySummary.planned > 0 &&
    alerts.monthlySummary.actual > alerts.monthlySummary.planned;
  const hasAlerts =
    receiptReviewCount > 0 || creditDueCount > 0 || budgetAlertCount > 0 ||
    Boolean(weeklyOver) || Boolean(monthlyOver);
  

  const activeSummary = isSignedIn ? summary : localSummary.data;
  const activeRecent = isSignedIn ? recent : localRecent.data;
  const totalSpent = activeSummary?.totalSpent ?? 0;
  const totalBudget = activeSummary?.totalBudget ?? 0;
  const uncategorizedCount = activeSummary?.uncategorizedCount ?? 0;
  const uncategorizedAmount = activeSummary?.uncategorizedAmount ?? 0;
  const remaining = totalBudget - totalSpent;
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const categoryGroups = activeSummary?.categories
    ? buildCategoryGroups(activeSummary.categories as CategorySummary[])
    : [];

  /* ── Render ── */

  return (
    <ScreenScrollView edges={['top']} contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.xl }]}>

      {/* ─── Sign-in banner ─── */}
      {!entitlements.canUsePlaid && (
        <Card variant="accent">
          <View style={{ gap: spacing.sm }}>
            <ThemedText style={[typography.bodySemiBold, { color: colors.text }]}>
              {t(language, 'anonymousBanner')}
            </ThemedText>
            <Button variant="primary" size="sm" onPress={() => router.push('/sign-in')}>
              {t(language, 'signIn')}
            </Button>
          </View>
        </Card>
      )}

      {/* ─── Header ─── */}
      <View style={[styles.titleRow, { marginBottom: -spacing.sm }]}>
        <ThemedText type="title">{t(language, 'dashboard')}</ThemedText>
        <Button variant="outline" size="sm" onPress={() => router.push('/(screens)/accounts')}>
          {t(language, 'manageAccounts')}
        </Button>
      </View>

      {/* ─── Net Worth Card ─── */}
      {isSignedIn && netWorth ? (
        <Pressable onPress={() => router.push('/(screens)/net-worth')}>
          <Card variant="elevated">
            <View style={{ gap: spacing.sm }}>
              <ThemedText style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                Net worth
              </ThemedText>
              <ThemedText style={[typography.title, { fontSize: 32, lineHeight: 38 }]}>
                {formatMoney(netWorth.netWorthTotal)}
              </ThemedText>
              <View style={styles.summaryRow}>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                  Checking {formatMoney(netWorth.checkingTotal)}
                </ThemedText>
                <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                  Savings + Investments {formatMoney(netWorth.savingsTotal + netWorth.investmentTotal)}
                </ThemedText>
              </View>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                Liabilities {formatMoney(netWorth.liabilitiesTotal)}
              </ThemedText>
            </View>
          </Card>
        </Pressable>
      ) : null}

      {/* ─── Summary Hero Card ─── */}
      {(summaryError || localSummary.error) ? (
        <Card>
          <View style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
            <ThemedText style={{ color: colors.textSecondary }}>{t(language, 'checkConnection')}</ThemedText>
            {__DEV__ && (summaryError?.message || localSummary.error?.message) ? (
              <ThemedText style={{ color: colors.textMuted }}>{summaryError?.message ?? localSummary.error?.message}</ThemedText>
            ) : null}
          </View>
        </Card>
      ) : !activeSummary ? (
        <Card>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : (
        <Card variant="elevated">
          <View style={{ gap: spacing.lg }}>
            {/* Large spent amount */}
            <View style={{ gap: 2 }}>
              <ThemedText style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                {t(language, 'spent')}
              </ThemedText>
              <ThemedText
                style={[
                  typography.title,
                  { fontSize: 34, lineHeight: 40, color: remaining < 0 ? colors.error : colors.text },
                ]}
              >
                {formatMoney(totalSpent)}
              </ThemedText>
            </View>

            {/* Progress bar */}
            <View style={{ gap: spacing.xs }}>
              <ProgressBar
                spent={totalSpent}
                budget={totalBudget}
                color={remaining < 0 ? colors.error : colors.primary}
                trackColor={colors.primaryMuted}
                height={10}
              />
              <View style={styles.summaryRow}>
                <ThemedText style={[typography.bodySemiBold, { color: remaining < 0 ? colors.error : colors.success }]}>
                  {formatMoney(Math.abs(remaining))} {remaining < 0 ? t(language, 'overBudget') : t(language, 'remaining')}
                </ThemedText>
                <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                  {spentPct}% · {formatMoney(totalBudget)} {t(language, 'budget').toLowerCase()}
                </ThemedText>
              </View>
            </View>

            {isSignedIn && summary?.lastSyncAt ? (
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, 'lastSync')}: {new Date(summary.lastSyncAt).toLocaleString()}
              </ThemedText>
            ) : null}
          </View>
        </Card>
      )}

      {/* ─── Quick Actions ─── */}
      <View style={{ gap: spacing.sm }}>
        <SectionLabel>{t(language, 'quickActions')}</SectionLabel>
        <View style={[styles.actionGrid, { gap: spacing.sm }]}>
          <Button
            variant="secondary"
            onPress={onSync}
            disabled={!entitlements.canUsePlaid || syncing}
            style={{ flex: 1, minWidth: 0 }}
          >
            {syncing ? 'Syncing...' : `${t(language, 'syncNow')}`}
          </Button>
          <Button
            variant="accent"
            onPress={onScanReceipt}
            disabled={!entitlements.canUseAi || uploading}
            style={{ flex: 1, minWidth: 0 }}
          >
            {`${t(language, 'scanReceipt')}`}
          </Button>
        </View>
        {syncStatus ? (
          <ThemedText
            style={[
              typography.caption,
              {
                color:
                  syncStatus.tone === 'success'
                    ? colors.success
                    : syncStatus.tone === 'partial'
                      ? colors.warning
                      : colors.error,
              },
            ]}
          >
            {syncStatus.text}
          </ThemedText>
        ) : null}
      </View>

      {/* ─── Alerts ─── */}
      {isSignedIn && hasAlerts && (
        <View style={{ gap: spacing.sm }}>
          <SectionLabel>{t(language, 'alerts')}</SectionLabel>
          <Card variant="accent" noPadding>
            <View style={{ overflow: 'hidden', borderRadius: borderRadius.lg }}>
              {receiptReviewCount > 0 && (
                <View style={[styles.alertRow, { padding: spacing.md, borderLeftColor: colors.warning, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <ThemedText style={{ fontSize: 16 }}>🧾</ThemedText>
                    <ThemedText style={[typography.body, { color: colors.text, flex: 1 }]}>
                      {t(language, 'receiptReviewAlert')
                        .replace('{items}', String(receiptReviewCount))
                        .replace('{receipts}', String(receiptCount))}
                    </ThemedText>
                  </View>
                </View>
              )}
              {budgetAlertCount > 0 && (
                <View style={[styles.alertRow, { padding: spacing.md, borderLeftColor: colors.error, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <ThemedText style={{ fontSize: 16 }}>⚠️</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[typography.bodySemiBold, { color: colors.error }]}>
                        {t(language, 'budgetAlerts')}
                      </ThemedText>
                      <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                        {budgetAlertCount} {budgetAlertCount === 1 ? 'category' : 'categories'} over budget
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}
              {creditDueCount > 0 && alerts?.creditDue?.upcoming?.length ? (
                <View style={[styles.alertRow, { padding: spacing.md, borderLeftColor: colors.accent, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flex: 1 }}>
                    <ThemedText style={{ fontSize: 16 }}>💳</ThemedText>
                    <View style={{ flex: 1, gap: 2 }}>
                      {alerts.creditDue.upcoming.slice(0, 2).map((card: any) => (
                        <View key={card._id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <ThemedText style={[typography.body, { color: colors.text }]}>{card.name}</ThemedText>
                          <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{card.dueDate}</ThemedText>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
              {weeklyOver && (
                <View style={[styles.alertRow, { padding: spacing.md, borderLeftColor: colors.error, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <ThemedText style={{ fontSize: 16 }}>📊</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[typography.bodySemiBold, { color: colors.text }]}>{t(language, 'weeklySummary')}</ThemedText>
                      <ThemedText style={[typography.caption, { color: colors.error }]}>
                        {formatMoney(alerts!.weeklySummary.actual)} / {formatMoney(alerts!.weeklySummary.planned)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}
              {monthlyOver && (
                <View style={[styles.alertRow, { padding: spacing.md, borderLeftColor: colors.error, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <ThemedText style={{ fontSize: 16 }}>📈</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[typography.bodySemiBold, { color: colors.text }]}>{t(language, 'monthlySummary')}</ThemedText>
                      <ThemedText style={[typography.caption, { color: colors.error }]}>
                        {formatMoney(alerts!.monthlySummary.actual)} / {formatMoney(alerts!.monthlySummary.planned)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              )}
              {/* {overBudgetCount > 0 && (
                <View style={[styles.alertRow, { padding: spacing.md, borderLeftColor: colors.error, borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <ThemedText style={{ fontSize: 16 }}>⚠️</ThemedText>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[typography.bodySemiBold, { color: colors.error }]}>{t(language, 'overBudget')}</ThemedText>
                    </View>
                  </View>
                </View>
              )} */}
            </View>
          </Card>
        </View>
      )}

      {/* ─── Uncategorized ─── */}
      {uncategorizedCount > 0 && (
        <Card variant="accent">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: borderRadius.pill,
                backgroundColor: colors.warning,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ThemedText style={{ fontSize: 20, color: '#fff' }}>?</ThemedText>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <ThemedText style={[typography.bodySemiBold, { color: colors.text }]}>
                {uncategorizedCount} {t(language, 'uncategorized')}
              </ThemedText>
              <ThemedText style={[typography.caption, { color: colors.textSecondary }]}>
                {t(language, 'transactions')} · {formatMoney(uncategorizedAmount)}
              </ThemedText>
            </View>
            <Button
              variant="primary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: '/transactions',
                  params: { uncategorizedOnly: '1' },
                })
              }
            >
              {t(language, 'viewAll')}
            </Button>
          </View>
        </Card>
      )}

      {/* ─── Budget Categories (grouped) ─── */}
      {categoryGroups.length > 0 ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle">{t(language, 'budgets')}</ThemedText>
            <Button variant="ghost" size="sm" onPress={() => router.push('/budgets')}>
              {t(language, 'viewAll')}
            </Button>
          </View>

          {categoryGroups.map((group) => {
            const { parent, children, totalSpent: gSpent, totalBudget: gBudget } = group;
            const gRemaining = gBudget - gSpent;
            const gOver = gSpent > gBudget && gBudget > 0;
            const hasChildren = children.length > 0;
            const isExpanded = expandedGroups.has(String(parent.categoryId));
            const barColor = parent.color ?? (gOver ? colors.error : colors.accent);

            return (
              <Card key={parent.categoryId}>
                <View style={{ gap: spacing.sm }}>
                  {/* ── Parent header row ── */}
                  <Pressable
                    onPress={() => hasChildren && toggleGroup(String(parent.categoryId))}
                    style={styles.summaryRow}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
                      {parent.icon ? (
                        <ThemedText style={{ fontSize: 18 }}>{parent.icon}</ThemedText>
                      ) : null}
                      <ThemedText type="defaultSemiBold" numberOfLines={1}>
                        {parent.name}
                      </ThemedText>
                      {hasChildren && (
                        <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                          {isExpanded ? '▾' : '▸'} {children.length}
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText
                      style={[typography.bodySemiBold, { color: gOver ? colors.error : colors.success }]}
                    >
                      {formatMoney(gRemaining)}
                    </ThemedText>
                  </Pressable>

                  {/* ── Parent progress ── */}
                  <ProgressBar
                    spent={gSpent}
                    budget={gBudget}
                    color={barColor}
                    trackColor={colors.accentMuted}
                  />
                  <View style={styles.summaryRow}>
                    <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                      {formatMoney(gSpent)} / {formatMoney(gBudget)}
                    </ThemedText>
                    {gOver && (
                      <ThemedText style={[typography.caption, { color: colors.error }]}>
                        {t(language, 'overBudget')}
                      </ThemedText>
                    )}
                  </View>

                  {/* ── Expanded subcategories ── */}
                  {hasChildren && isExpanded && (
                    <View
                      style={{
                        marginTop: spacing.xs,
                        paddingTop: spacing.sm,
                        borderTopWidth: 1,
                        borderTopColor: colors.borderLight,
                        gap: spacing.md,
                      }}
                    >
                      {children.map((sub) => {
                        const subOver = sub.overBudget;
                        const subColor = sub.color ?? (subOver ? colors.error : colors.primary);
                        return (
                          <View key={sub.categoryId} style={{ gap: spacing.xs }}>
                            <View style={styles.summaryRow}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}>
                                {sub.icon ? (
                                  <ThemedText style={{ fontSize: 14 }}>{sub.icon}</ThemedText>
                                ) : null}
                                <ThemedText style={[typography.body, { color: colors.textSecondary }]} numberOfLines={1}>
                                  {sub.name}
                                </ThemedText>
                              </View>
                              <ThemedText
                                style={[typography.caption, { color: subOver ? colors.error : colors.textSecondary }]}
                              >
                                {formatMoney(sub.spent)} / {formatMoney(sub.budgetAmount)}
                              </ThemedText>
                            </View>
                            <ProgressBar
                              spent={sub.spent}
                              budget={sub.budgetAmount}
                              color={subColor}
                              trackColor={colors.primaryMuted}
                              height={5}
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      ) : activeSummary ? (
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'budgets')}</ThemedText>
          <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noBudgets')}</ThemedText>
        </View>
      ) : null}

      {/* ─── Recent Transactions ─── */}
      <View style={{ gap: spacing.md }}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle">{t(language, 'recentTransactions')}</ThemedText>
          <Button variant="ghost" size="sm" onPress={() => router.push('/transactions')}>
            {t(language, 'viewAll')}
          </Button>
        </View>
        {(recentError || localRecent.error) ? (
          <Card>
            <View style={{ gap: spacing.xs }}>
              <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>{t(language, 'checkConnection')}</ThemedText>
            </View>
          </Card>
        ) : !activeRecent ? (
          <Card>
            <ActivityIndicator size="small" color={colors.primary} />
          </Card>
        ) : activeRecent.items.length ? (
          <Card noPadding>
            {activeRecent.items.map((tx, idx) => (
              <View
                key={tx._id}
                style={[
                  styles.txRow,
                  { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
                  idx < activeRecent.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
              >
                <ThemedText style={[typography.body, { flexShrink: 1 }]} numberOfLines={1}>{tx.name}</ThemedText>
                <ThemedText style={[typography.bodySemiBold, { color: tx.amount < 0 ? colors.success : colors.text }]}>
                  {formatMoney(tx.amount)}
                </ThemedText>
              </View>
            ))}
          </Card>
        ) : (
          <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noTransactions')}</ThemedText>
        )}
      </View>
    </ScreenScrollView>
  );
}

/* ───────────────── Styles ───────────────── */

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  alertRow: {
    borderLeftWidth: 3,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTrack: {
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
