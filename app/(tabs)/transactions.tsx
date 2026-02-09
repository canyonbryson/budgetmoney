import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useLocalSearchParams } from 'expo-router';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
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
  createTransaction,
  getCategories,
  listTransactions,
  setTransactionCategory,
} from '@/lib/localDb';

export default function TransactionsScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography, shadows } = useAppTheme();
  const [search, setSearch] = React.useState('');
  const [selectedTx, setSelectedTx] = React.useState<any | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string | null>(null);
  const [rememberRule, setRememberRule] = React.useState(false);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autoStatus, setAutoStatus] = React.useState<string | null>(null);
  const [autoRunning, setAutoRunning] = React.useState(false);
  const [filterStartDate, setFilterStartDate] = React.useState('');
  const [filterEndDate, setFilterEndDate] = React.useState('');
  const [filterMinAmount, setFilterMinAmount] = React.useState('');
  const [filterMaxAmount, setFilterMaxAmount] = React.useState('');
  const [filterCategoryId, setFilterCategoryId] = React.useState<string | null>(null);
  const [filterAccountId, setFilterAccountId] = React.useState<string | null>(null);
  const [filterPendingOnly, setFilterPendingOnly] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [newModalVisible, setNewModalVisible] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newAmount, setNewAmount] = React.useState('');
  const [newDate, setNewDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [newCategoryId, setNewCategoryId] = React.useState<string | null>(null);
  const [newPending, setNewPending] = React.useState(false);
  const [newError, setNewError] = React.useState<string | null>(null);
  const [newSaving, setNewSaving] = React.useState(false);
  const [openedFromParam, setOpenedFromParam] = React.useState(false);
  const params = useLocalSearchParams();

  type TransactionsData = {
    items: {
      _id: string;
      name: string;
      date: string;
      amount: number;
      categoryName?: string;
      categoryId?: string;
    }[];
  };
  let data: TransactionsData | undefined;
  let dataError: Error | null = null;
  const parsedMinAmount = filterMinAmount.trim().length
    ? Number(filterMinAmount)
    : undefined;
  const parsedMaxAmount = filterMaxAmount.trim().length
    ? Number(filterMaxAmount)
    : undefined;
  try {
    data = useQuery(
      api.transactions.list,
      owner && isSignedIn
        ? {
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            search: search.trim() || undefined,
            startDate: filterStartDate.trim() || undefined,
            endDate: filterEndDate.trim() || undefined,
            categoryId: filterCategoryId ?? undefined,
            accountId: filterAccountId ?? undefined,
            minAmount:
              parsedMinAmount !== undefined && Number.isFinite(parsedMinAmount)
                ? parsedMinAmount
                : undefined,
            maxAmount:
              parsedMaxAmount !== undefined && Number.isFinite(parsedMaxAmount)
                ? parsedMaxAmount
                : undefined,
            pending: filterPendingOnly ? true : undefined,
          }
        : 'skip'
    );
  } catch (error) {
    dataError = error as Error;
  }
  const localData = useLocalQuery(
    () =>
      listTransactions({
        search: search.trim() || undefined,
        startDate: filterStartDate.trim() || undefined,
        endDate: filterEndDate.trim() || undefined,
        categoryId: filterCategoryId ?? undefined,
        minAmount:
          parsedMinAmount !== undefined && Number.isFinite(parsedMinAmount)
            ? parsedMinAmount
            : undefined,
        maxAmount:
          parsedMaxAmount !== undefined && Number.isFinite(parsedMaxAmount)
            ? parsedMaxAmount
            : undefined,
        pending: filterPendingOnly ? true : undefined,
      }),
    [search, filterStartDate, filterEndDate, filterCategoryId, filterMinAmount, filterMaxAmount, filterPendingOnly],
    !isSignedIn
  );

  const categories = useQuery(
    api.categories.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localCategories = useLocalQuery(getCategories, [], !isSignedIn);
  const accounts = useQuery(
    api.plaid.listAccounts,
    owner && entitlements.canUsePlaid && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId }
      : 'skip'
  );
  const setCategory = useMutation(api.transactions.setCategory);
  const createManual = useMutation(api.transactions.createManual);
  const autoCategorize = useAction(api.transactions.autoCategorizeMissing);

  React.useEffect(() => {
    if (!__DEV__) return;
    console.info('[Transactions]', {
      isReady,
      isSignedIn,
      owner,
      data,
      dataError: dataError?.message,
      localData: localData.data,
      localDataError: localData.error?.message,
      categories,
      accounts,
    });
  }, [
    isReady,
    isSignedIn,
    owner,
    data,
    dataError,
    localData.data,
    localData.error,
    categories,
    accounts,
  ]);

  const categoryLabels = React.useMemo(() => {
    const list = isSignedIn ? categories : localCategories.data;
    if (!list) return [];
    const map = new Map(list.map((c: any) => [c._id ?? c.id, c]));
    return list.map((cat: any) => {
      const parent = cat.parentId ? map.get(cat.parentId) : undefined;
      const label = parent ? `${parent.name} › ${cat.name}` : cat.name;
      return { id: cat._id ?? cat.id, label };
    });
  }, [categories, localCategories.data, isSignedIn]);

  const openModal = (tx: any) => {
    setSelectedTx(tx);
    setSelectedCategoryId(tx.categoryId ?? null);
    setRememberRule(false);
    setError(null);
    setModalVisible(true);
  };

  const onSaveCategory = async () => {
    if (!owner || !selectedTx || !selectedCategoryId) return;
    try {
      setSaving(true);
      if (!isSignedIn) {
        await setTransactionCategory(selectedTx._id, selectedCategoryId);
        bumpRefresh();
      } else {
        await setCategory({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          transactionId: selectedTx._id,
          categoryId: selectedCategoryId as any,
          rememberRule,
        });
      }
      setModalVisible(false);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update category.');
    } finally {
      setSaving(false);
    }
  };

  const onAutoCategorize = async () => {
    if (!owner || !entitlements.canUseAi) return;
    setAutoRunning(true);
    setAutoStatus(null);
    try {
      const result = await autoCategorize({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
      });
      const updated = typeof result?.updated === 'number' ? result.updated : 0;
      setAutoStatus(
        updated
          ? t(language, 'autoCategorizeUpdated').replace('{count}', String(updated))
          : t(language, 'autoCategorizeNone')
      );
    } catch (err: any) {
      setAutoStatus(err?.message ?? t(language, 'autoCategorizeFailed'));
    } finally {
      setAutoRunning(false);
    }
  };

  React.useEffect(() => {
    if (!params?.openNew || openedFromParam) return;
    openNewModal();
    setOpenedFromParam(true);
  }, [params?.openNew, openedFromParam]);

  const openNewModal = () => {
    setNewModalVisible(true);
    setNewError(null);
    setNewName('');
    setNewAmount('');
    setNewCategoryId(null);
    setNewPending(false);
    setNewDate(new Date().toISOString().slice(0, 10));
  };

  const onCreateManual = async () => {
    if (!owner) return;
    const amountText = newAmount.trim();
    const amount = amountText.length ? Number(amountText) : Number.NaN;
    if (!newName.trim() || !Number.isFinite(amount)) {
      setNewError(t(language, 'saveFailed'));
      return;
    }
    setNewSaving(true);
    setNewError(null);
    try {
      if (!isSignedIn) {
        await createTransaction({
          name: newName.trim(),
          amount,
          date: newDate.trim(),
          categoryId: newCategoryId ?? null,
          pending: newPending,
        });
        bumpRefresh();
      } else {
        await createManual({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          name: newName.trim(),
          amount,
          date: newDate.trim(),
          categoryId: newCategoryId ?? undefined,
          pending: newPending,
        });
      }
      setNewModalVisible(false);
    } catch (err: any) {
      setNewError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setNewSaving(false);
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

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText type="title">{t(language, 'transactions')}</ThemedText>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <Button variant="primary" size="sm" onPress={openNewModal}>{t(language, 'addTransaction')}</Button>
          <Button variant="accent" size="sm" onPress={onAutoCategorize} disabled={!entitlements.canUseAi || autoRunning}>
            {t(language, 'autoCategorize')}
          </Button>
        </View>
      </View>
      {autoStatus ? (
        <Card variant="muted">
          <ThemedText style={[typography.caption, { color: colors.primary }]}>{autoStatus}</ThemedText>
        </Card>
      ) : null}

      {/* Search */}
      <TextInput
        style={inputStyle}
        placeholder={t(language, 'search')}
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {/* Filters */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Pressable onPress={() => setShowFilters((v) => !v)} style={styles.filterToggle}>
            <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
              {t(language, 'filters')}
            </ThemedText>
            <ThemedText style={[typography.caption, { color: colors.primary }]}>
              {showFilters ? 'Hide' : 'Show'}
            </ThemedText>
          </Pressable>
          {showFilters && (
            <View style={{ gap: spacing.sm }}>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  placeholder={t(language, 'startDate')}
                  placeholderTextColor={colors.textMuted}
                  value={filterStartDate}
                  onChangeText={setFilterStartDate}
                />
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  placeholder={t(language, 'endDate')}
                  placeholderTextColor={colors.textMuted}
                  value={filterEndDate}
                  onChangeText={setFilterEndDate}
                />
              </View>
              <View style={[styles.row, { gap: spacing.sm }]}>
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  placeholder={t(language, 'minAmount')}
                  placeholderTextColor={colors.textMuted}
                  value={filterMinAmount}
                  onChangeText={setFilterMinAmount}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[inputStyle, { flex: 1 }]}
                  placeholder={t(language, 'maxAmount')}
                  placeholderTextColor={colors.textMuted}
                  value={filterMaxAmount}
                  onChangeText={setFilterMaxAmount}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ gap: spacing.xs }}>
                <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{t(language, 'category')}</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                  <Pressable
                    onPress={() => setFilterCategoryId(null)}
                    style={[
                      styles.filterPill,
                      { borderRadius: borderRadius.pill, borderColor: colors.border },
                      filterCategoryId === null && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                    ]}
                  >
                    <ThemedText style={[typography.caption, filterCategoryId === null && { color: colors.primary, fontWeight: '600' }]}>
                      {t(language, 'all')}
                    </ThemedText>
                  </Pressable>
                  {categoryLabels.map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setFilterCategoryId(cat.id)}
                      style={[
                        styles.filterPill,
                        { borderRadius: borderRadius.pill, borderColor: colors.border },
                        filterCategoryId === cat.id && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                      ]}
                    >
                      <ThemedText style={[typography.caption, filterCategoryId === cat.id && { color: colors.primary, fontWeight: '600' }]}>
                        {cat.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              {accounts && accounts.length ? (
                <View style={{ gap: spacing.xs }}>
                  <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{t(language, 'accounts')}</ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
                    <Pressable
                      onPress={() => setFilterAccountId(null)}
                      style={[
                        styles.filterPill,
                        { borderRadius: borderRadius.pill, borderColor: colors.border },
                        filterAccountId === null && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                      ]}
                    >
                      <ThemedText style={[typography.caption, filterAccountId === null && { color: colors.accent, fontWeight: '600' }]}>
                        {t(language, 'all')}
                      </ThemedText>
                    </Pressable>
                    {accounts.map((acct: any) => (
                      <Pressable
                        key={acct._id}
                        onPress={() => setFilterAccountId(acct.plaidAccountId)}
                        style={[
                          styles.filterPill,
                          { borderRadius: borderRadius.pill, borderColor: colors.border },
                          filterAccountId === acct.plaidAccountId && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                        ]}
                      >
                        <ThemedText style={[typography.caption, filterAccountId === acct.plaidAccountId && { color: colors.accent, fontWeight: '600' }]}>
                          {acct.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <View style={[styles.row, { gap: spacing.sm, alignItems: 'center' }]}>
                <ThemedText style={typography.caption}>{t(language, 'pendingOnly')}</ThemedText>
                <Switch
                  value={filterPendingOnly}
                  onValueChange={setFilterPendingOnly}
                  trackColor={{ false: colors.borderLight, true: colors.primaryMuted }}
                  thumbColor={filterPendingOnly ? colors.primary : colors.icon}
                />
              </View>
            </View>
          )}
        </View>
      </Card>

      {/* Transaction List */}
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
      ) : !(isSignedIn ? data : localData.data) ? (
        <Card>
          <ActivityIndicator size="small" color={colors.primary} />
        </Card>
      ) : (isSignedIn ? data : localData.data)!.items.length ? (
        <Card noPadding>
          {(isSignedIn ? data : localData.data)!.items.map((tx, idx, arr) => {
            const flags: string[] = [];
            if (tx.isTransfer) flags.push(t(language, 'transfer'));
            if (tx.isRefund) flags.push(t(language, 'refund'));
            if (tx.isCreditCardPayment) flags.push(t(language, 'creditPayment'));
            if (tx.isCreditPurchase) flags.push(t(language, 'creditPurchase'));

            return (
              <Pressable key={tx._id} onPress={() => openModal(tx)}>
                <View
                  style={[
                    styles.txRow,
                    { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
                    idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                  ]}
                >
                  <View style={{ gap: 3, flex: 1 }}>
                    <ThemedText type="defaultSemiBold">{tx.name}</ThemedText>
                    <View style={[styles.row, { gap: spacing.xs, alignItems: 'center' }]}>
                      <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{tx.date}</ThemedText>
                      {tx.categoryName ? (
                        <View style={[styles.catPill, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.pill }]}>
                          <ThemedText style={[typography.caption, { color: colors.primary, fontSize: 11 }]}>{tx.categoryName}</ThemedText>
                        </View>
                      ) : (
                        <View style={[styles.catPill, { backgroundColor: colors.accentMuted, borderRadius: borderRadius.pill }]}>
                          <ThemedText style={[typography.caption, { color: colors.accent, fontSize: 11 }]}>{t(language, 'uncategorized')}</ThemedText>
                        </View>
                      )}
                    </View>
                    {flags.length ? (
                      <View style={[styles.row, { gap: spacing.xs, marginTop: 2 }]}>
                        {flags.map((label) => (
                          <View
                            key={`${tx._id}-${label}`}
                            style={[styles.catPill, { backgroundColor: colors.primaryMuted, borderRadius: borderRadius.pill }]}
                          >
                            <ThemedText style={{ fontSize: 10, color: colors.textMuted }}>{label}</ThemedText>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <ThemedText style={[typography.bodySemiBold, { color: tx.amount < 0 ? colors.success : colors.text }]}>
                    {formatMoney(tx.amount)}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <ThemedText style={{ color: colors.textMuted }}>{t(language, 'noTransactions')}</ThemedText>
      )}

      {/* Category Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={[styles.modalBackdrop, { backgroundColor: colors.modalBackdrop }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundElevated, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]}>
            <ThemedText type="subtitle">{t(language, 'category')}</ThemedText>
            <ScrollView style={styles.modalList}>
              {categoryLabels.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[
                    { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderLight, borderRadius: borderRadius.sm },
                    selectedCategoryId === cat.id ? { backgroundColor: colors.primaryMuted } : null,
                  ]}
                >
                  <ThemedText style={selectedCategoryId === cat.id ? { color: colors.primary, fontWeight: '600' } : undefined}>{cat.label}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.rememberRow}>
              <ThemedText>{t(language, 'createRule')}</ThemedText>
              <Switch value={rememberRule} onValueChange={setRememberRule} disabled={!isSignedIn} />
            </View>

            {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}

            <View style={[styles.modalActions, { gap: spacing.sm }]}>
              <Button variant="outline" onPress={() => setModalVisible(false)}>{t(language, 'cancel')}</Button>
              <Button variant="primary" onPress={onSaveCategory} disabled={saving || !selectedCategoryId}>{t(language, 'save')}</Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* New Transaction Modal */}
      <Modal visible={newModalVisible} transparent animationType="slide">
        <View style={[styles.modalBackdrop, { backgroundColor: colors.modalBackdrop }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.backgroundElevated, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg }]}>
            <ThemedText type="subtitle">{t(language, 'addTransaction')}</ThemedText>
            <TextInput
              style={inputStyle}
              placeholder={t(language, 'transactionName')}
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />
            <View style={[styles.row, { gap: spacing.sm }]}>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                placeholder={t(language, 'amount')}
                placeholderTextColor={colors.textMuted}
                value={newAmount}
                onChangeText={setNewAmount}
                keyboardType="numeric"
              />
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                placeholder={t(language, 'date')}
                placeholderTextColor={colors.textMuted}
                value={newDate}
                onChangeText={setNewDate}
              />
            </View>

            <ThemedText style={[typography.caption, { color: colors.textMuted }]}>{t(language, 'category')}</ThemedText>
            <ScrollView style={styles.modalList}>
              <Pressable onPress={() => setNewCategoryId(null)} style={{ paddingVertical: spacing.xs }}>
                <ThemedText style={!newCategoryId ? { color: colors.primary, fontWeight: '600' } : undefined}>
                  {t(language, 'uncategorized')}
                </ThemedText>
              </Pressable>
              {categoryLabels.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setNewCategoryId(cat.id)}
                  style={{ paddingVertical: spacing.xs }}
                >
                  <ThemedText style={newCategoryId === cat.id ? { color: colors.primary, fontWeight: '600' } : undefined}>
                    {cat.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.rememberRow}>
              <ThemedText>{t(language, 'pending')}</ThemedText>
              <Switch value={newPending} onValueChange={setNewPending} />
            </View>

            {newError ? <ThemedText style={{ color: colors.error }}>{newError}</ThemedText> : null}

            <View style={[styles.modalActions, { gap: spacing.sm }]}>
              <Button variant="outline" onPress={() => setNewModalVisible(false)}>{t(language, 'cancel')}</Button>
              <Button variant="primary" onPress={onCreateManual} disabled={newSaving || !newName.trim() || !newAmount.trim()}>{t(language, 'save')}</Button>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 8,
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  catPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filterToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterPill: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '80%',
  },
  modalList: {
    maxHeight: 280,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});
