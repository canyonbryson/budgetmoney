import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';

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
  addShoppingListItem,
  getShoppingListCurrentWeek,
  moveShoppingListItemToPantry,
  setShoppingListItemChecked,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

type FilterKey = 'all' | 'needed' | 'pantry' | 'checked';

export default function ShoppingListScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [filter, setFilter] = React.useState<FilterKey>('needed');
  const [search, setSearch] = React.useState('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newQuantity, setNewQuantity] = React.useState('');
  const [newUnit, setNewUnit] = React.useState('');
  const [newCost, setNewCost] = React.useState('');

  const shoppingList = useQuery(
    api.mealPlans.getShoppingListCurrentWeek,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localShoppingList = useLocalQuery(getShoppingListCurrentWeek, [], !isSignedIn);
  const generateList = useAction(api.mealPlans.generateShoppingList);
  const setChecked = useMutation(api.mealPlans.setShoppingListItemChecked);
  const moveToPantry = useMutation(api.mealPlans.moveShoppingListItemToPantry);

  const onGenerate = async () => {
    if (!owner || !entitlements.canUseAi || !isSignedIn) return;
    await generateList({ ownerType: owner.ownerType, ownerId: owner.ownerId });
  };

  const onToggleChecked = async (itemId: Id<'shoppingListItems'>, nextValue: boolean) => {
    if (!owner) return;
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
  };

  const onMoveToPantry = async (itemId: Id<'shoppingListItems'>) => {
    if (!owner) return;
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

  const onAddItem = async () => {
    if (!newItemName.trim()) return;
    const parsedQuantity = newQuantity.trim().length ? Number(newQuantity) : undefined;
    const parsedCost = newCost.trim().length ? Number(newCost) : undefined;
    if (newQuantity.trim().length && !Number.isFinite(parsedQuantity)) return;
    if (newCost.trim().length && !Number.isFinite(parsedCost)) return;
    await addShoppingListItem({
      itemName: newItemName.trim(),
      quantity: parsedQuantity,
      unit: newUnit.trim() || undefined,
      estimatedCost: parsedCost,
    });
    bumpRefresh();
    setNewItemName('');
    setNewQuantity('');
    setNewUnit('');
    setNewCost('');
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
      <ThemedText type="title">{t(language, 'shoppingList')}</ThemedText>

      <ThemedView style={styles.actions}>
        <Button onPress={onGenerate} disabled={!entitlements.canUseAi || !isSignedIn}>
          {t(language, 'generateList')}
        </Button>
      </ThemedView>

      {!isSignedIn ? (
        <ThemedView style={[styles.row, { gap: spacing.sm }]}>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder={t(language, 'addItem')}
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={newQuantity}
            onChangeText={setNewQuantity}
            placeholder={t(language, 'quantity')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={newUnit}
            onChangeText={setNewUnit}
            placeholder={t(language, 'unit')}
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={newCost}
            onChangeText={setNewCost}
            placeholder={t(language, 'amount')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          <Button onPress={onAddItem}>{t(language, 'addItem')}</Button>
        </ThemedView>
      ) : null}

      <TextInput
        style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
        value={search}
        onChangeText={setSearch}
        placeholder={t(language, 'search')}
        placeholderTextColor={colors.textMuted}
      />

      <ThemedView style={[styles.filterRow, { gap: spacing.sm }]}>
        {[
          { key: 'all', label: t(language, 'all') },
          { key: 'needed', label: t(language, 'needed') },
          { key: 'pantry', label: t(language, 'inPantry') },
          { key: 'checked', label: t(language, 'checked') },
        ].map((option) => {
          const isActive = filter === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setFilter(option.key as FilterKey)}
              style={[
                styles.pill,
                { borderRadius: borderRadius.pill, borderColor: colors.border },
                isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
            >
              <ThemedText style={isActive ? { ...typography.caption, fontWeight: '600' } : typography.caption}>
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ThemedView>

      {(isSignedIn ? shoppingList : localShoppingList.data) ? (
        <ThemedView style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.border }]}>
          <ThemedText type="defaultSemiBold">{t(language, 'pricingEstimated')}</ThemedText>
          <ThemedText type="defaultSemiBold">
            {formatCurrency((isSignedIn ? shoppingList : localShoppingList.data)!.totalEstimatedCost)}
          </ThemedText>
        </ThemedView>
      ) : null}

      {isSignedIn ? !shoppingList : !localShoppingList.data ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : filteredItems.length ? (
        <ThemedView style={{ gap: spacing.sm }}>
          {filteredItems.map((item: any) => {
            const pantryLabel =
              item.coverage === 'partial' && item.remainingQuantity !== undefined ? (
                <ThemedText style={{ fontSize: 12, color: colors.textMuted }}>
                  {t(language, 'needed')}: {formatQuantity(item.remainingQuantity, item.remainingUnit)}
                </ThemedText>
              ) : item.inPantry ? (
                <ThemedText style={{ fontSize: 12, color: colors.textMuted }}>{t(language, 'inPantry')}</ThemedText>
              ) : null;

            return (
              <TouchableOpacity
                key={item._id}
                onPress={() => onToggleChecked(item._id, !item.isChecked)}
                style={[
                  styles.row,
                  { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight, gap: spacing.sm },
                  item.isChecked && { opacity: 0.6 },
                ]}
              >
                <ThemedView style={{ flex: 1, gap: 6 }}>
                  <ThemedText style={item.isChecked ? { textDecorationLine: 'line-through' } : undefined}>
                    {item.itemName}
                  </ThemedText>
                  <ThemedView style={styles.itemMeta}>
                    {item.quantity !== undefined ? (
                      <ThemedText type="defaultSemiBold">
                        {formatQuantity(item.quantity, item.unit)}
                      </ThemedText>
                    ) : null}
                    {item.priceSource === 'online' ? (
                      <ThemedText style={{ fontSize: 12, color: colors.textMuted }}>{t(language, 'onlineEstimate')}</ThemedText>
                    ) : null}
                    {pantryLabel}
                    {item.isChecked ? (
                      <TouchableOpacity
                        onPress={() => onMoveToPantry(item._id)}
                        style={[styles.pill, { borderRadius: borderRadius.pill, borderColor: colors.border }]}
                      >
                        <ThemedText style={typography.label}>
                          {t(language, 'moveToPantry')}
                        </ThemedText>
                      </TouchableOpacity>
                    ) : null}
                  </ThemedView>
                </ThemedView>
                <ThemedView style={{ alignItems: 'flex-end', gap: 6 }}>
                  <ThemedText>{formatCurrency(item.estimatedCost)}</ThemedText>
                  {item.isChecked ? (
                    <ThemedText style={{ fontSize: 12, color: colors.textMuted }}>{t(language, 'checked')}</ThemedText>
                  ) : null}
                </ThemedView>
              </TouchableOpacity>
            );
          })}
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noItems')}</ThemedText>
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  input: {
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
});
