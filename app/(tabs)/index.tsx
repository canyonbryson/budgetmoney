import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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

function ProgressBar({ spent, budget, color, trackColor }: { spent: number; budget: number; color: string; trackColor: string }) {
  const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const { borderRadius } = useAppTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor, borderRadius: borderRadius.pill }]}>
      <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: color, borderRadius: borderRadius.pill }]} />
    </View>
  );
}

export default function DashboardScreen() {
  const { language } = useSettings();
  const { owner, entitlements, isReady, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const [uploading, setUploading] = React.useState(false);

  type SummaryData = {
    totalSpent: number;
    totalBudget: number;
    lastSyncAt?: number;
    categories?: {
      categoryId: Id<'categories'>;
      name?: string | null;
      spent: number;
      budgetAmount: number;
      remaining: number;
      overBudget: boolean;
    }[];
  };
  type RecentData = {
    items: { _id: Id<'transactions'>; name: string; amount: number }[];
  };

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
        ? {
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            limit: 6,
          }
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

  React.useEffect(() => {
    if (!__DEV__) return;
    console.info('[Dashboard]', {
      isReady,
      isSignedIn,
      owner,
      summary,
      summaryError: summaryError?.message,
      localSummary: localSummary.data,
      localSummaryError: localSummary.error?.message,
      recent,
      recentError: recentError?.message,
      localRecent: localRecent.data,
      localRecentError: localRecent.error?.message,
      alerts,
    });
  }, [
    isReady,
    isSignedIn,
    owner,
    summary,
    summaryError,
    localSummary.data,
    localSummary.error,
    recent,
    recentError,
    localRecent.data,
    localRecent.error,
    alerts,
  ]);

  const alerts = useQuery(
    api.notifications.getAlerts,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );

  const onSync = async () => {
    if (!owner || !isSignedIn) return;
    await syncNow({ ownerType: owner.ownerType, ownerId: owner.ownerId });
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
      const uploadUrl = await generateUploadUrl({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': blob.type || 'image/jpeg',
        },
        body: blob,
      });
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      const { storageId } = await uploadResponse.json();

      const receiptId = await createFromUpload({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        storageId,
      });

      await parseReceipt({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId,
      });
    } finally {
      setUploading(false);
    }
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

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
    receiptReviewCount > 0 ||
    creditDueCount > 0 ||
    budgetAlertCount > 0 ||
    Boolean(weeklyOver) ||
    Boolean(monthlyOver);

  const activeSummary = isSignedIn ? summary : localSummary.data;
  const activeRecent = isSignedIn ? recent : localRecent.data;
  const totalSpent = activeSummary?.totalSpent ?? 0;
  const totalBudget = activeSummary?.totalBudget ?? 0;
  const remaining = totalBudget - totalSpent;
  const spentPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      {/* Sign-in banner */}
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

      {/* Title + Manage */}
      <View style={styles.titleRow}>
        <ThemedText type="title">{t(language, 'dashboard')}</ThemedText>
        <Button variant="outline" size="sm" onPress={() => router.push('/(screens)/accounts')}>
          {t(language, 'manageAccounts')}
        </Button>
      </View>

      {/* Summary Hero Card */}
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
          <View style={{ gap: spacing.md }}>
            {/* Spent / Budget row */}
            <View style={styles.summaryRow}>
              <View style={{ gap: 2 }}>
                <ThemedText style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  {t(language, 'spent')}
                </ThemedText>
                <ThemedText style={[typography.title, { color: remaining < 0 ? colors.error : colors.text }]}>
                  {formatMoney(totalSpent)}
                </ThemedText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <ThemedText style={[typography.caption, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
                  {t(language, 'budget')}
                </ThemedText>
                <ThemedText style={[typography.subtitle, { color: colors.textSecondary }]}>
                  {formatMoney(totalBudget)}
                </ThemedText>
              </View>
            </View>

            {/* Progress bar */}
            <ProgressBar
              spent={totalSpent}
              budget={totalBudget}
              color={remaining < 0 ? colors.error : colors.primary}
              trackColor={colors.primaryMuted}
            />

            {/* Remaining summary */}
            <View style={styles.summaryRow}>
              <ThemedText style={[typography.bodySemiBold, { color: remaining < 0 ? colors.error : colors.success }]}>
                {formatMoney(Math.abs(remaining))} {remaining < 0 ? t(language, 'overBudget') : t(language, 'remaining')}
              </ThemedText>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {spentPct}%
              </ThemedText>
            </View>

            {isSignedIn && summary?.lastSyncAt ? (
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, 'lastSync')}: {new Date(summary.lastSyncAt).toLocaleString()}
              </ThemedText>
            ) : null}
          </View>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'quickActions')}
          </ThemedText>
          <View style={[styles.actionGrid, { gap: spacing.sm }]}>
            <Button variant="secondary" size="sm" onPress={onSync} disabled={!entitlements.canUsePlaid}>
              {t(language, 'syncNow')}
            </Button>
            <Button variant="accent" size="sm" onPress={onScanReceipt} disabled={!entitlements.canUseAi || uploading}>
              {t(language, 'scanReceipt')}
            </Button>
            <Button variant="outline" size="sm" onPress={() => router.push({ pathname: '/transactions', params: { openNew: '1' } })}>
              {t(language, 'addTransaction')}
            </Button>
          </View>
        </View>
      </Card>

      {/* Alerts */}
      {isSignedIn && hasAlerts && (
        <Card variant="accent">
          <View style={{ gap: spacing.sm }}>
            <ThemedText style={[typography.label, { color: colors.text, textTransform: 'uppercase', letterSpacing: 1 }]}>
              {t(language, 'alerts')}
            </ThemedText>
            {receiptReviewCount > 0 && (
              <ThemedText style={{ color: colors.text }}>
                {t(language, 'receiptReviewAlert')
                  .replace('{items}', String(receiptReviewCount))
                  .replace('{receipts}', String(receiptCount))}
              </ThemedText>
            )}
            {budgetAlertCount > 0 && (
              <ThemedText style={{ color: colors.text }}>
                {t(language, 'budgetAlerts')}: {budgetAlertCount}
              </ThemedText>
            )}
            {creditDueCount > 0 && alerts?.creditDue?.upcoming?.length ? (
              <View style={{ gap: 2 }}>
                {alerts.creditDue.upcoming.slice(0, 2).map((card: any) => (
                  <ThemedText key={card._id} style={{ color: colors.text }}>
                    {card.name}: {card.dueDate}
                  </ThemedText>
                ))}
              </View>
            ) : null}
            {weeklyOver && (
              <ThemedText style={{ color: colors.text }}>
                {t(language, 'weeklySummary')}: {formatMoney(alerts!.weeklySummary.actual)} / {formatMoney(alerts!.weeklySummary.planned)}
              </ThemedText>
            )}
            {monthlyOver && (
              <ThemedText style={{ color: colors.text }}>
                {t(language, 'monthlySummary')}: {formatMoney(alerts!.monthlySummary.actual)} / {formatMoney(alerts!.monthlySummary.planned)}
              </ThemedText>
            )}
            <Button variant="primary" size="sm" onPress={() => router.push('/receipts')}>
              {t(language, 'reviewReceipts')}
            </Button>
          </View>
        </Card>
      )}

      {/* Budget Categories */}
      {activeSummary?.categories?.length ? (
        <View style={{ gap: spacing.md }}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle">{t(language, 'budgets')}</ThemedText>
            <Button variant="ghost" size="sm" onPress={() => router.push('/budgets')}>
              {t(language, 'viewAll')}
            </Button>
          </View>
          {activeSummary.categories.map((cat) => (
            <Card key={cat.categoryId}>
              <View style={{ gap: spacing.sm }}>
                <View style={styles.summaryRow}>
                  <ThemedText type="defaultSemiBold">{cat.name}</ThemedText>
                  <ThemedText style={[typography.bodySemiBold, { color: cat.overBudget ? colors.error : colors.success }]}>
                    {formatMoney(cat.remaining)}
                  </ThemedText>
                </View>
                <ProgressBar
                  spent={cat.spent}
                  budget={cat.budgetAmount}
                  color={cat.overBudget ? colors.error : colors.accent}
                  trackColor={colors.accentMuted}
                />
                <View style={styles.summaryRow}>
                  <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                    {formatMoney(cat.spent)} / {formatMoney(cat.budgetAmount)}
                  </ThemedText>
                  {cat.overBudget && (
                    <ThemedText style={[typography.caption, { color: colors.error }]}>
                      {t(language, 'overBudget')}
                    </ThemedText>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : activeSummary ? (
        <View style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'budgets')}</ThemedText>
          <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noBudgets')}</ThemedText>
        </View>
      ) : null}

      {/* Recent Transactions */}
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
                <ThemedText style={typography.body}>{tx.name}</ThemedText>
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
