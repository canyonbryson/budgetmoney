import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
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
  getBudgetAllocation,
  setCategoryRolloverMode as setLocalRolloverMode,
  updateBudgetAllocations,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

const rolloverModes = ['none', 'positive', 'negative', 'both'] as const;

type RolloverMode = typeof rolloverModes[number];

type AllocationData = {
  periodStart: string;
  parent: {
    categoryId: Id<'categories'>;
    name: string;
    amount: number;
    rolloverMode?: RolloverMode;
  };
  children: {
    categoryId: Id<'categories'>;
    name: string;
    amount: number;
    rolloverMode?: RolloverMode;
  }[];
};

export default function BudgetAllocateScreen() {
  const params = useLocalSearchParams();
  const categoryId = params.categoryId as Id<'categories'> | undefined;
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [parentAmount, setParentAmount] = React.useState('');
  const [subDrafts, setSubDrafts] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rolloverSaving, setRolloverSaving] = React.useState<Record<string, boolean>>({});

  let data: AllocationData | undefined;
  let dataError: Error | null = null;
  try {
    data = useQuery(
      api.budgets.getAllocation,
      owner && categoryId && isSignedIn
        ? { ownerType: owner.ownerType, ownerId: owner.ownerId, parentCategoryId: categoryId }
        : 'skip'
    );
  } catch (err) {
    dataError = err as Error;
  }
  const localData = useLocalQuery(
    () => (categoryId ? getBudgetAllocation(categoryId) : Promise.resolve(undefined as any)),
    [categoryId],
    !isSignedIn && Boolean(categoryId)
  );

  const updateAllocations = useMutation(api.budgets.updateAllocations);
  const setRolloverMode = useMutation(api.categories.setRolloverMode);

  React.useEffect(() => {
    const source = isSignedIn ? data : localData.data;
    if (!source) return;
    setParentAmount(String(source.parent.amount));
    const nextDrafts: Record<string, string> = {};
    source.children.forEach((child) => {
      nextDrafts[child.categoryId] = String(child.amount);
    });
    setSubDrafts(nextDrafts);
  }, [data?.parent.amount, data?.children?.length, localData.data, isSignedIn]);

  const rolloverLabels = React.useMemo(
    () => ({
      none: t(language, 'rolloverNone'),
      positive: t(language, 'rolloverPositive'),
      negative: t(language, 'rolloverNegative'),
      both: t(language, 'rolloverBoth'),
    }),
    [language]
  );

  const getSubAmount = (id: string, fallback: number) => {
    const raw = subDrafts[id];
    if (raw === undefined) return fallback;
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };

  const parsedParentAmount = parentAmount.trim().length ? Number(parentAmount) : Number.NaN;
  const invalidParent = !Number.isFinite(parsedParentAmount);
  const source = isSignedIn ? data : localData.data;
  const subTotals = source
    ? source.children.map((child) => ({
        id: child.categoryId,
        amount: getSubAmount(child.categoryId, child.amount),
      }))
    : [];
  const invalidSub = subTotals.some((row) => !Number.isFinite(row.amount));
  const subTotalValue = subTotals.reduce((sum, row) => sum + (Number.isFinite(row.amount) ? row.amount : 0), 0);
  const isBalanced = !invalidParent && !invalidSub && Math.abs(subTotalValue - parsedParentAmount) < 0.01;

  const onSave = async () => {
    if (!owner || !categoryId) return;
    if (invalidParent || invalidSub) {
      setError(t(language, 'invalidAmount'));
      return;
    }
    if (!isBalanced) {
      setError(t(language, 'allocationMismatch'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!isSignedIn) {
        await updateBudgetAllocations(
          categoryId,
          parsedParentAmount,
          subTotals.map((row) => ({ categoryId: row.id, amount: row.amount }))
        );
        bumpRefresh();
      } else {
        await updateAllocations({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          parentCategoryId: categoryId,
          parentAmount: parsedParentAmount,
          allocations: subTotals.map((row) => ({
            categoryId: row.id as Id<'categories'>,
            amount: row.amount,
          })),
        });
      }
      router.back();
    } catch (err: any) {
      setError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onSetRollover = async (catId: Id<'categories'>, mode: RolloverMode) => {
    if (!owner) return;
    setRolloverSaving((prev) => ({ ...prev, [catId]: true }));
    try {
      if (!isSignedIn) {
        await setLocalRolloverMode(catId, mode);
        bumpRefresh();
      } else {
        await setRolloverMode({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          id: catId,
          rolloverMode: mode,
        });
      }
    } finally {
      setRolloverSaving((prev) => ({ ...prev, [catId]: false }));
    }
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}> 
      {(dataError || localData.error) ? (
        <ThemedView style={{ gap: spacing.xs }}>
          <ThemedText type="defaultSemiBold">{t(language, 'loadFailed')}</ThemedText>
          <ThemedText>{t(language, 'checkConnection')}</ThemedText>
        </ThemedView>
      ) : !(isSignedIn ? data : localData.data) ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <>
          <ThemedText type="title">{t(language, 'allocate')} {(isSignedIn ? data : localData.data)!.parent.name}</ThemedText>

          <ThemedView style={{ gap: spacing.sm }}>
            <ThemedText type="subtitle">{t(language, 'parentBudget')}</ThemedText>
            <TextInput
              style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
              keyboardType="numeric"
              value={parentAmount}
              onChangeText={setParentAmount}
              placeholder={t(language, 'budget')}
              placeholderTextColor={colors.textMuted}
            />
            <ThemedText style={!isBalanced && !invalidParent ? { color: colors.error } : undefined}>
              {t(language, 'allocatedTotal')}: {formatMoney(subTotalValue)} / {formatMoney(parsedParentAmount || 0)}
            </ThemedText>
            <ThemedView style={{ gap: spacing.xs }}>
              <ThemedText>{t(language, 'rollover')}</ThemedText>
              <View style={[styles.rolloverRow, { gap: spacing.sm }]}> 
                {rolloverModes.map((mode) => {
                  const isActive = ((isSignedIn ? data : localData.data)!.parent.rolloverMode ?? 'none') === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => onSetRollover((isSignedIn ? data : localData.data)!.parent.categoryId, mode)}
                      disabled={rolloverSaving[(isSignedIn ? data : localData.data)!.parent.categoryId]}
                      style={[
                        styles.rolloverPill,
                        { borderRadius: borderRadius.pill, borderColor: colors.border },
                        isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                      ]}
                    >
                      <ThemedText style={isActive ? { ...typography.caption, fontWeight: '600' } : typography.caption}>
                        {rolloverLabels[mode]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </ThemedView>
          </ThemedView>

          <ThemedView style={{ gap: spacing.sm }}>
            <ThemedText type="subtitle">{t(language, 'subcategories')}</ThemedText>
            {(isSignedIn ? data : localData.data)!.children.map((child) => (
              <ThemedView key={child.categoryId} style={[styles.card, { borderRadius: borderRadius.md, borderColor: colors.borderLight, padding: spacing.md, gap: spacing.sm }]}> 
                <View style={{ gap: 4 }}>
                  <ThemedText type="defaultSemiBold">{child.name}</ThemedText>
                  <TextInput
                    style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                    keyboardType="numeric"
                    value={subDrafts[child.categoryId] ?? String(child.amount)}
                    onChangeText={(val) => setSubDrafts((prev) => ({ ...prev, [child.categoryId]: val }))}
                    placeholder={t(language, 'budget')}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <ThemedView style={{ gap: spacing.xs }}>
                  <ThemedText>{t(language, 'rollover')}</ThemedText>
                  <View style={[styles.rolloverRow, { gap: spacing.sm }]}> 
                    {rolloverModes.map((mode) => {
                      const isActive = (child.rolloverMode ?? 'none') === mode;
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => onSetRollover(child.categoryId, mode)}
                          disabled={rolloverSaving[child.categoryId]}
                          style={[
                            styles.rolloverPill,
                            { borderRadius: borderRadius.pill, borderColor: colors.border },
                            isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                          ]}
                        >
                          <ThemedText style={isActive ? { ...typography.caption, fontWeight: '600' } : typography.caption}>
                            {rolloverLabels[mode]}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>

          <ThemedView style={{ gap: spacing.sm }}>
            {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
            {invalidParent || invalidSub ? (
              <ThemedText style={{ color: colors.error }}>{t(language, 'invalidAmount')}</ThemedText>
            ) : null}
            <View style={[styles.actions, { gap: spacing.sm }]}> 
              <Button onPress={() => router.back()}>{t(language, 'cancel')}</Button>
              <Button onPress={onSave} disabled={saving || invalidParent || invalidSub || !isBalanced}>
                {t(language, 'save')}
              </Button>
            </View>
          </ThemedView>
        </>
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
  input: {
    height: 36,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  rolloverRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rolloverPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
