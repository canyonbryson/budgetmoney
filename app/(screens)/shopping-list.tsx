import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAction, useMutation, useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';

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
  addShoppingListItem,
  deleteShoppingListItem,
  generateShoppingListForWeek as generateLocalShoppingListForWeek,
  getShoppingListForWeek as getLocalShoppingListForWeek,
  moveShoppingListItemToPantry,
  setShoppingListItemChecked,
  updateShoppingListItem,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

type FilterKey = 'all' | 'needed' | 'pantry' | 'checked';

const FILTERS: { key: FilterKey; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'all', icon: 'list' },
  { key: 'needed', icon: 'cart-outline' },
  { key: 'pantry', icon: 'home-outline' },
  { key: 'checked', icon: 'checkmark-done-outline' },
];

export default function ShoppingListScreen() {
  const params = useLocalSearchParams<{ weekStart?: string }>();
  const weekStart =
    typeof params.weekStart === 'string' && params.weekStart.length ? params.weekStart : undefined;
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography, shadows } = useAppTheme();
  const [filter, setFilter] = React.useState<FilterKey>('needed');
  const [search, setSearch] = React.useState('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newQuantity, setNewQuantity] = React.useState('');
  const [newUnit, setNewUnit] = React.useState('');
  const [newCost, setNewCost] = React.useState('');
  const [editingId, setEditingId] = React.useState<Id<'shoppingListItems'> | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null);
  const [showAddForm, setShowAddForm] = React.useState(false);

  const shoppingListCurrentWeek = useQuery(
    api.mealPlans.getShoppingListCurrentWeek,
    owner && isSignedIn && !weekStart
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId }
      : 'skip',
  );
  const shoppingListForSelectedWeek = useQuery(
    api.mealPlans.getShoppingListForWeek,
    owner && isSignedIn && weekStart
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, weekStart }
      : 'skip',
  );
  const shoppingList = weekStart ? shoppingListForSelectedWeek : shoppingListCurrentWeek;
  const localShoppingList = useLocalQuery(
    () => getLocalShoppingListForWeek(weekStart),
    [weekStart ?? 'current'],
    !isSignedIn,
  );
  const generateList = useAction(api.mealPlans.generateShoppingList);
  const addItemRemote = useMutation(api.mealPlans.addShoppingListItem);
  const updateItemRemote = useMutation(api.mealPlans.updateShoppingListItem);
  const deleteItemRemote = useMutation(api.mealPlans.deleteShoppingListItem);
  const setChecked = useMutation(api.mealPlans.setShoppingListItemChecked);
  const moveToPantry = useMutation(api.mealPlans.moveShoppingListItemToPantry);

  const onGenerate = async () => {
    if (!owner || isGenerating) return;
    setFeedbackError(null);
    setIsGenerating(true);
    try {
      if (!isSignedIn) {
        await generateLocalShoppingListForWeek(weekStart);
        bumpRefresh();
      } else {
        await generateList({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          weekStart,
        });
      }
    } catch (error: any) {
      setFeedbackError(error?.message ?? t(language, 'estimateFailed'));
    } finally {
      setIsGenerating(false);
    }
  };

  const onToggleChecked = async (itemId: Id<'shoppingListItems'>, nextValue: boolean) => {
    if (!owner) return;
    setFeedbackError(null);
    try {
      if (!isSignedIn) {
        await setShoppingListItemChecked(itemId, nextValue);
        bumpRefresh();
      } else {
        await setChecked({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId,
          isChecked: nextValue,
        });
      }
    } catch (error: any) {
      setFeedbackError(error?.message ?? t(language, 'estimateFailed'));
    }
  };

  const onMoveToPantry = async (itemId: Id<'shoppingListItems'>) => {
    if (!owner) return;
    setFeedbackError(null);
    try {
      if (!isSignedIn) {
        await moveShoppingListItemToPantry(itemId);
        bumpRefresh();
      } else {
        await moveToPantry({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId,
        });
      }
    } catch (error: any) {
      setFeedbackError(error?.message ?? t(language, 'estimateFailed'));
    }
  };

  const formatQuantity = (quantity?: number | null, unit?: string | null) => {
    if (quantity === null || quantity === undefined) return '';
    const normalizedUnit = unit?.toLowerCase();
    if (!unit || normalizedUnit === 'ea' || normalizedUnit === 'x' || normalizedUnit === 'each') {
      return `${quantity}`;
    }
    return `${quantity} ${unit}`;
  };

  const formatCurrency = (value?: number | null) => {
    if (value === null || value === undefined) return '';
    return formatMoney(value);
  };

  const getPriceSourceLabel = (item: any) => {
    if (item.priceSource === 'walmart' || item.priceSource === 'online' || item.priceSource === 'winco') {
      return t(language, 'walmartEstimate');
    }
    if (item.priceSource === 'ai') {
      const lowConfidence =
        typeof item.estimateConfidence === 'number' && item.estimateConfidence < 0.5;
      return lowConfidence
        ? `${t(language, 'aiEstimate')} (${t(language, 'lowConfidence')})`
        : t(language, 'aiEstimate');
    }
    return null;
  };

  const filteredItems = React.useMemo(() => {
    const list = isSignedIn ? shoppingList?.items : localShoppingList.data?.items;
    if (!list) return [];
    const query = search.trim().toLowerCase();
    return list.filter((item: any) => {
      if (query && !item.itemName.toLowerCase().includes(query)) return false;
      if (filter === 'checked') return Boolean(item.isChecked);
      if (filter === 'pantry') return Boolean(item.inPantry);
      if (filter === 'needed') return !item.isChecked && item.coverage !== 'full';
      return true;
    });
  }, [shoppingList, localShoppingList.data, search, filter, isSignedIn]);

  const shoppingListData = isSignedIn ? shoppingList : localShoppingList.data;
  const isListLoading = isSignedIn ? !shoppingList : localShoppingList.loading;
  const hasAnyItems = (shoppingListData?.items?.length ?? 0) > 0;

  const onAddItem = async () => {
    if (!owner || !newItemName.trim()) return;
    const parsedQuantity = newQuantity.trim().length ? Number(newQuantity) : undefined;
    const parsedCost = newCost.trim().length ? Number(newCost) : undefined;
    if (newQuantity.trim().length && !Number.isFinite(parsedQuantity)) {
      setFeedbackError(t(language, 'invalidAmount'));
      return;
    }
    if (newCost.trim().length && !Number.isFinite(parsedCost)) {
      setFeedbackError(t(language, 'invalidAmount'));
      return;
    }
    setFeedbackError(null);
    try {
      if (!isSignedIn) {
        if (editingId) {
          await updateShoppingListItem({
            itemId: editingId,
            itemName: newItemName.trim(),
            quantity: parsedQuantity,
            unit: newUnit.trim() || undefined,
            estimatedCost: parsedCost,
          });
        } else {
          await addShoppingListItem({
            itemName: newItemName.trim(),
            quantity: parsedQuantity,
            unit: newUnit.trim() || undefined,
            estimatedCost: parsedCost,
          });
        }
        bumpRefresh();
      } else {
        if (editingId) {
          await updateItemRemote({
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            itemId: editingId,
            itemName: newItemName.trim(),
            quantity: parsedQuantity,
            unit: newUnit.trim() || undefined,
            estimatedCost: parsedCost,
          });
        } else {
          await addItemRemote({
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            weekStart,
            itemName: newItemName.trim(),
            quantity: parsedQuantity,
            unit: newUnit.trim() || undefined,
            estimatedCost: parsedCost,
          });
        }
      }
      setEditingId(null);
      setNewItemName('');
      setNewQuantity('');
      setNewUnit('');
      setNewCost('');
      setShowAddForm(false);
    } catch (error: any) {
      setFeedbackError(error?.message ?? t(language, 'estimateFailed'));
    }
  };

  const onEditItem = (item: any) => {
    setEditingId(item._id);
    setNewItemName(item.itemName ?? '');
    setNewQuantity(
      item.quantity === undefined || item.quantity === null ? '' : String(item.quantity),
    );
    setNewUnit(item.unit ?? '');
    setNewCost(
      item.estimatedCost === undefined || item.estimatedCost === null
        ? ''
        : String(item.estimatedCost),
    );
    setShowAddForm(true);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setNewItemName('');
    setNewQuantity('');
    setNewUnit('');
    setNewCost('');
    setFeedbackError(null);
    setShowAddForm(false);
  };

  const onDeleteItem = async (itemId: Id<'shoppingListItems'>) => {
    if (!owner) return;
    setFeedbackError(null);
    try {
      if (!isSignedIn) {
        await deleteShoppingListItem(itemId);
        bumpRefresh();
      } else {
        await deleteItemRemote({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          itemId,
        });
      }
      if (editingId === itemId) {
        onCancelEdit();
      }
    } catch (error: any) {
      setFeedbackError(error?.message ?? t(language, 'deleteFailed'));
    }
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  const checkedCount = React.useMemo(() => {
    const list = isSignedIn ? shoppingList?.items : localShoppingList.data?.items;
    if (!list) return 0;
    return list.filter((i: any) => i.isChecked).length;
  }, [shoppingList, localShoppingList.data, isSignedIn]);

  const totalCount = shoppingListData?.items?.length ?? 0;

  const inputStyle = [
    styles.input,
    {
      borderRadius: borderRadius.md,
      borderColor: colors.borderLight,
      color: colors.text,
      backgroundColor: colors.backgroundCard,
      ...typography.body,
    },
  ];

  return (
    <ScreenScrollView
      contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title">{t(language, 'shoppingList')}</ThemedText>
          {hasAnyItems ? (
            <ThemedText style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              {checkedCount}/{totalCount} {t(language, 'checked').toLowerCase()}
            </ThemedText>
          ) : null}
        </View>
        <View style={[styles.headerActions, { gap: spacing.sm }]}>
          <Pressable
            onPress={() => {
              setShowAddForm(!showAddForm);
              if (editingId) onCancelEdit();
            }}
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.primary,
                borderRadius: borderRadius.md,
                width: 40,
                height: 40,
              },
            ]}
          >
            <Ionicons
              name={showAddForm ? 'close' : 'add'}
              size={22}
              color={colors.textOnPrimary}
            />
          </Pressable>
          <Button onPress={onGenerate} disabled={isGenerating} size="sm">
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              t(language, 'generateList')
            )}
          </Button>
        </View>
      </View>

      {isSignedIn && !entitlements.canUseAi ? (
        <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
          {t(language, 'walmartEstimate')}
        </ThemedText>
      ) : null}

      {feedbackError ? (
        <Card variant="accent" style={{ borderColor: colors.error }}>
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <ThemedText style={[typography.body, { color: colors.error, flex: 1 }]}>
              {feedbackError}
            </ThemedText>
          </View>
        </Card>
      ) : null}

      {/* Add / Edit Form */}
      {showAddForm ? (
        <Card variant="elevated">
          <View style={{ gap: spacing.md }}>
            <ThemedText type="defaultSemiBold">
              {editingId ? t(language, 'edit') : t(language, 'addItem')}
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder={t(language, 'addItem')}
              placeholderTextColor={colors.textMuted}
            />
            <View style={[styles.formRow, { gap: spacing.sm }]}>
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={newQuantity}
                onChangeText={setNewQuantity}
                placeholder={t(language, 'quantity')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={newUnit}
                onChangeText={setNewUnit}
                placeholder={t(language, 'unit')}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[inputStyle, { flex: 1 }]}
                value={newCost}
                onChangeText={setNewCost}
                placeholder={t(language, 'amount')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.formActions, { gap: spacing.sm }]}>
              <Button onPress={onAddItem} style={{ flex: 1 }}>
                {editingId ? t(language, 'save') : t(language, 'addItem')}
              </Button>
              {editingId ? (
                <Button onPress={onCancelEdit} variant="outline" style={{ flex: 1 }}>
                  {t(language, 'cancel')}
                </Button>
              ) : null}
            </View>
          </View>
        </Card>
      ) : null}

      {/* Search */}
      <View
        style={[
          styles.searchRow,
          {
            borderRadius: borderRadius.md,
            borderColor: colors.borderLight,
            backgroundColor: colors.backgroundCard,
            paddingHorizontal: spacing.md,
            ...shadows.sm,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text, ...typography.body }]}
          value={search}
          onChangeText={setSearch}
          placeholder={t(language, 'search')}
          placeholderTextColor={colors.textMuted}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter Pills */}
      <View style={[styles.filterRow, { gap: spacing.sm }]}>
        {FILTERS.map((option) => {
          const isActive = filter === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              style={[
                styles.filterPill,
                {
                  borderRadius: borderRadius.pill,
                  borderColor: isActive ? colors.primary : colors.borderLight,
                  backgroundColor: isActive ? colors.primaryMuted : colors.backgroundCard,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs + 2,
                  gap: 6,
                },
              ]}
            >
              <Ionicons
                name={option.icon}
                size={14}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <ThemedText
                style={[
                  typography.caption,
                  isActive ? { fontWeight: '600', color: colors.primary } : { color: colors.textSecondary },
                ]}
              >
                {t(language, option.key === 'pantry' ? 'inPantry' : option.key === 'needed' ? 'needed' : option.key === 'checked' ? 'checked' : 'all')}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Cost Summary */}
      {shoppingListData ? (
        <Card variant="muted" style={{ borderColor: colors.primary }}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIconWrap, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}>
              <Ionicons name="receipt-outline" size={18} color={colors.textOnPrimary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, 'pricingEstimated')}
              </ThemedText>
              <ThemedText type="defaultSemiBold" style={{ fontSize: 20 }}>
                {formatCurrency(shoppingListData.totalEstimatedCost)}
              </ThemedText>
            </View>
            {hasAnyItems ? (
              <View style={styles.progressWrap}>
                <ThemedText style={[typography.caption, { color: colors.textMuted, textAlign: 'right' }]}>
                  {checkedCount}/{totalCount}
                </ThemedText>
                <View
                  style={[
                    styles.progressTrack,
                    { backgroundColor: colors.borderLight, borderRadius: borderRadius.pill },
                  ]}
                >
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        borderRadius: borderRadius.pill,
                        width: totalCount > 0 ? `${(checkedCount / totalCount) * 100}%` : '0%',
                      },
                    ]}
                  />
                </View>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {/* Items List */}
      {isListLoading ? (
        <View style={[styles.centered, { paddingVertical: spacing.xxl }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filteredItems.length ? (
        <View style={{ gap: spacing.sm }}>
          {filteredItems.map((item: any) => {
            const qtyLabel = formatQuantity(item.quantity, item.unit);
            const costLabel = formatCurrency(item.estimatedCost);
            const isPartial = item.coverage === 'partial' && item.remainingQuantity !== undefined;
            const sourceLabel = getPriceSourceLabel(item);
            const sourceIcon =
              item.priceSource === 'ai' ? 'sparkles-outline' : 'storefront-outline';

            return (
              <Pressable
                key={item._id}
                onPress={() => onToggleChecked(item._id, !item.isChecked)}
                style={({ pressed }) => [
                  styles.itemCard,
                  {
                    borderRadius: borderRadius.lg,
                    borderColor: item.isChecked ? colors.borderLight : colors.borderLight,
                    backgroundColor: item.isChecked
                      ? colors.background
                      : colors.backgroundCard,
                    padding: spacing.md,
                    ...(!item.isChecked ? shadows.sm : {}),
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {/* Checkbox */}
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderRadius: borderRadius.sm,
                      borderColor: item.isChecked ? colors.primary : colors.border,
                      backgroundColor: item.isChecked ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {item.isChecked ? (
                    <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
                  ) : null}
                </View>

                {/* Content */}
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText
                    style={[
                      typography.bodySemiBold,
                      item.isChecked && {
                        textDecorationLine: 'line-through',
                        color: colors.textMuted,
                      },
                    ]}
                  >
                    {item.itemName}
                  </ThemedText>
                  <View style={styles.itemMeta}>
                    {qtyLabel ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: colors.primaryMuted,
                            borderRadius: borderRadius.pill,
                          },
                        ]}
                      >
                        <ThemedText style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                          {qtyLabel}
                        </ThemedText>
                      </View>
                    ) : null}
                    {isPartial ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: colors.accentMuted,
                            borderRadius: borderRadius.pill,
                          },
                        ]}
                      >
                        <ThemedText style={[typography.caption, { color: colors.accent }]}>
                          {t(language, 'needed')}: {formatQuantity(item.remainingQuantity, item.remainingUnit)}
                        </ThemedText>
                      </View>
                    ) : item.inPantry ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: colors.primaryMuted,
                            borderRadius: borderRadius.pill,
                          },
                        ]}
                      >
                        <Ionicons name="home-outline" size={11} color={colors.primary} />
                        <ThemedText style={[typography.caption, { color: colors.primary }]}>
                          {t(language, 'inPantry')}
                        </ThemedText>
                      </View>
                    ) : null}
                    {sourceLabel ? (
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: colors.backgroundElevated,
                            borderRadius: borderRadius.pill,
                          },
                        ]}
                      >
                        <Ionicons name={sourceIcon} size={11} color={colors.textMuted} />
                        <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                          {sourceLabel}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Right side: cost + actions */}
                <View style={styles.itemRight}>
                  {costLabel ? (
                    <ThemedText
                      style={[
                        typography.bodySemiBold,
                        item.isChecked && { color: colors.textMuted },
                      ]}
                    >
                      {costLabel}
                    </ThemedText>
                  ) : null}
                  <View style={[styles.itemActions, { gap: 2 }]}>
                    {item.isChecked ? (
                      <Pressable
                        onPress={(e: any) => {
                          e?.stopPropagation?.();
                          onMoveToPantry(item._id);
                        }}
                        accessibilityLabel={t(language, 'moveToPantry')}
                        hitSlop={6}
                        style={[styles.actionIcon, { borderRadius: borderRadius.sm }]}
                      >
                        <Ionicons name="home-outline" size={16} color={colors.primary} />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        onEditItem(item);
                      }}
                      accessibilityLabel={t(language, 'edit')}
                      hitSlop={6}
                      style={[styles.actionIcon, { borderRadius: borderRadius.sm }]}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                    <Pressable
                      onPress={(e: any) => {
                        e?.stopPropagation?.();
                        onDeleteItem(item._id);
                      }}
                      accessibilityLabel={t(language, 'delete')}
                      hitSlop={6}
                      style={[styles.actionIcon, { borderRadius: borderRadius.sm }]}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Card>
          <View style={styles.emptyState}>
            <Ionicons
              name={hasAnyItems ? 'filter-outline' : 'cart-outline'}
              size={40}
              color={colors.textMuted}
            />
            <ThemedText style={{ color: colors.textMuted, textAlign: 'center' }}>
              {hasAnyItems ? t(language, 'noItemsMatchFilters') : t(language, 'noItems')}
            </ThemedText>
            {!hasAnyItems ? (
              <Button onPress={onGenerate} size="sm" variant="secondary">
                {t(language, 'generateList')}
              </Button>
            ) : null}
          </View>
        </Card>
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  formRow: {
    flexDirection: 'row',
  },
  formActions: {
    flexDirection: 'row',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: {
    alignItems: 'flex-end',
    gap: 4,
    width: 64,
  },
  progressTrack: {
    height: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  input: {
    height: 44,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    padding: 6,
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
});
