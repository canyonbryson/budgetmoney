import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useLocalQuery } from '@/hooks/useLocalQuery';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import { getMonthSummary, getPlannedVsActual, getTrends } from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

export default function AnalyticsScreen() {
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, shadows } = useAppTheme();

  type Trends = { monthlyTotals: { month: string; total: number }[] };
  let trends: Trends | undefined;
  let trendsError: Error | null = null;
  try {
    trends = useQuery(
      api.analytics.getTrends,
      owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
    );
  } catch (error) {
    trendsError = error as Error;
  }
  const localTrends = useLocalQuery(getTrends, [], !isSignedIn);

  type PlannedVsActual = {
    weekStart: string;
    weekEnd: string;
    periodStart: string;
    periodEnd: string;
    weekly: { planned: number; actual: number };
    monthly: { planned: number; actual: number };
  };
  let planned: PlannedVsActual | undefined;
  let plannedError: Error | null = null;
  try {
    planned = useQuery(
      api.dashboard.getPlannedVsActual,
      owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
    );
  } catch (error) {
    plannedError = error as Error;
  }
  const localPlanned = useLocalQuery(getPlannedVsActual, [], !isSignedIn);

  type SummaryData = {
    totalSpent: number;
    totalBudget: number;
    categories?: {
      categoryId: Id<'categories'>;
      name?: string | null;
      spent: number;
      budgetAmount: number;
      remaining: number;
      overBudget: boolean;
    }[];
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

  React.useEffect(() => {
    if (!__DEV__) return;
    console.info('[Analytics]', {
      isReady,
      isSignedIn,
      owner,
      summary,
      summaryError: summaryError?.message,
      localSummary: localSummary.data,
      localSummaryError: localSummary.error?.message,
      trends,
      trendsError: trendsError?.message,
      localTrends: localTrends.data,
      localTrendsError: localTrends.error?.message,
      planned,
      plannedError: plannedError?.message,
      localPlanned: localPlanned.data,
      localPlannedError: localPlanned.error?.message,
    });
  }, [
    isReady,
    isSignedIn,
    owner,
    summary,
    summaryError,
    localSummary.data,
    localSummary.error,
    trends,
    trendsError,
    localTrends.data,
    localTrends.error,
    planned,
    plannedError,
    localPlanned.data,
    localPlanned.error,
  ]);

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}>
      <ThemedText type="title">{t(language, 'analytics')}</ThemedText>

      <ThemedView style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'plannedVsActual')}</ThemedText>
        {(plannedError || localPlanned.error) ? (
          <ThemedView style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
            <ThemedText>{t(language, 'checkConnection')}</ThemedText>
          </ThemedView>
        ) : !(isSignedIn ? planned : localPlanned.data) ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <ThemedView style={{ gap: spacing.sm }}>
            <ThemedView style={[styles.card, { padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.border, gap: spacing.xs + 2, ...shadows.sm }]}>
              <ThemedText type="defaultSemiBold">{t(language, 'weekly')}</ThemedText>
              <ThemedText>
                {t(language, 'planned')}: {formatMoney((isSignedIn ? planned : localPlanned.data)!.weekly.planned)}
              </ThemedText>
              <ThemedText>
                {t(language, 'actual')}: {formatMoney((isSignedIn ? planned : localPlanned.data)!.weekly.actual)}
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.card, { padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.border, gap: spacing.xs + 2, ...shadows.sm }]}>
              <ThemedText type="defaultSemiBold">{t(language, 'monthly')}</ThemedText>
              <ThemedText>
                {t(language, 'planned')}: {formatMoney((isSignedIn ? planned : localPlanned.data)!.monthly.planned)}
              </ThemedText>
              <ThemedText>
                {t(language, 'actual')}: {formatMoney((isSignedIn ? planned : localPlanned.data)!.monthly.actual)}
              </ThemedText>
            </ThemedView>
          </ThemedView>
        )}
      </ThemedView>

      <ThemedView style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'budgetVsActual')}</ThemedText>
        {(summaryError || localSummary.error) ? (
          <ThemedView style={{ gap: spacing.xs }}>
            <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
            <ThemedText>{t(language, 'checkConnection')}</ThemedText>
          </ThemedView>
        ) : !(isSignedIn ? summary : localSummary.data) ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <ThemedView style={[styles.card, { padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.border, gap: spacing.xs + 2, ...shadows.sm }]}>
            <ThemedText type="defaultSemiBold">
              {t(language, 'spent')}: {formatMoney((isSignedIn ? summary : localSummary.data)!.totalSpent)}
            </ThemedText>
            <ThemedText type="defaultSemiBold">
              {t(language, 'budget')}: {formatMoney((isSignedIn ? summary : localSummary.data)!.totalBudget)}
            </ThemedText>
            <ThemedText type="defaultSemiBold">
              {t(language, 'remaining')}: {formatMoney((isSignedIn ? summary : localSummary.data)!.totalBudget - (isSignedIn ? summary : localSummary.data)!.totalSpent)}
            </ThemedText>
            {(isSignedIn ? summary : localSummary.data)?.categories?.length ? (
              <ThemedView style={{ gap: spacing.sm }}>
                {(isSignedIn ? summary : localSummary.data)!.categories!.map((cat) => (
                  <ThemedView key={cat.categoryId} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                    <ThemedText>{cat.name}</ThemedText>
                    {cat.overBudget ? (
                      <ThemedText style={{ color: colors.error }}>{t(language, 'overBudget')}</ThemedText>
                    ) : (
                      <ThemedText>{formatMoney(cat.remaining)}</ThemedText>
                    )}
                  </ThemedView>
                ))}
              </ThemedView>
            ) : null}
          </ThemedView>
        )}
      </ThemedView>

      {(trendsError || localTrends.error) ? (
        <ThemedView style={{ gap: spacing.xs }}>
          <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
          <ThemedText>{t(language, 'checkConnection')}</ThemedText>
          {__DEV__ && (trendsError?.message || localTrends.error?.message) ? (
            <ThemedText>{trendsError?.message ?? localTrends.error?.message}</ThemedText>
          ) : null}
        </ThemedView>
      ) : !(isSignedIn ? trends : localTrends.data) ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (isSignedIn ? trends : localTrends.data)!.monthlyTotals.length ? (
        <ThemedView style={{ gap: spacing.sm }}>
          {(isSignedIn ? trends : localTrends.data)!.monthlyTotals.map((row) => (
            <ThemedView key={row.month} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
              <ThemedText>{row.month}</ThemedText>
              <ThemedText>{formatMoney(row.total)}</ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noTransactions')}</ThemedText>
      )}
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
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
