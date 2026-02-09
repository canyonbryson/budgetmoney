import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/Button';
import { useIdentity } from '@/contexts/IdentityContext';
import { useSettings } from '@/contexts/SettingsContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';
import type { Id } from '@/convex/_generated/dataModel';

export default function ReceiptDetailScreen() {
  const { owner, isReady, isSignedIn } = useIdentity();
  const { language } = useSettings();
  const { colors, spacing, borderRadius, shadows } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams();
  const receiptIdParam = Array.isArray(params.receiptId)
    ? params.receiptId[0]
    : params.receiptId;
  const receiptId = receiptIdParam as Id<'receipts'> | undefined;

  const detail = useQuery(
    api.receipts.getDetail,
    owner && receiptId && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, receiptId }
      : 'skip'
  );
  const categories = useQuery(
    api.categories.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const candidates = useQuery(
    api.receipts.listCandidateTransactions,
    owner && receiptId && isSignedIn
      ? { ownerType: owner.ownerType, ownerId: owner.ownerId, receiptId }
      : 'skip'
  );
  const linkToTransaction = useMutation(api.receipts.linkToTransaction);
  const updateLineItem = useMutation(api.receipts.updateLineItem);
  const markReceiptReviewed = useMutation(api.receipts.markReviewed);
  const [linking, setLinking] = React.useState<Id<'transactions'> | null>(null);
  const [updatingItemId, setUpdatingItemId] = React.useState<Id<'receiptLineItems'> | null>(null);
  const [markingReviewed, setMarkingReviewed] = React.useState(false);

  const onLink = async (transactionId: Id<'transactions'>) => {
    if (!owner || !receiptId) return;
    setLinking(transactionId);
    try {
      await linkToTransaction({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId,
        transactionId,
      });
    } finally {
      setLinking(null);
    }
  };

  const onSelectCategory = async (
    item: any,
    categoryId: Id<'categories'> | null
  ) => {
    if (!owner) return;
    setUpdatingItemId(item._id);
    try {
      await updateLineItem({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        lineItemId: item._id,
        name: item.name,
        quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
        price: typeof item.price === 'number' ? item.price : undefined,
        grocerySubCategoryId: categoryId ?? undefined,
        clearGrocerySubCategory: !categoryId,
        markReviewed: true,
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const onMarkReviewed = async () => {
    if (!owner || !receiptId) return;
    setMarkingReviewed(true);
    try {
      await markReceiptReviewed({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        receiptId,
      });
    } finally {
      setMarkingReviewed(false);
    }
  };

  if (!isReady) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!isSignedIn) {
    return (
      <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}>
        <ThemedText>{t(language, 'upgradeToUnlock')} {t(language, 'receipts')}</ThemedText>
      </ScreenScrollView>
    );
  }

  if (detail === undefined) {
    return (
      <ScreenWrapper style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenWrapper>
    );
  }

  if (!detail) {
    return (
      <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
        <ThemedText>{t(language, 'noReceipts')}</ThemedText>
      </ScreenScrollView>
    );
  }

  const allCategories = categories ?? [];
  const categoryById = new Map(allCategories.map((cat) => [cat._id, cat]));
  const groceriesParent =
    allCategories.find((cat) => !cat.parentId && cat.name?.toLowerCase() === 'groceries') ??
    allCategories.find((cat) => cat.name?.toLowerCase() === 'groceries');
  const grocerySubcategories = groceriesParent
    ? allCategories.filter((cat) => cat.parentId === groceriesParent._id)
    : [];
  const categoriesLoaded = categories !== undefined;

  const splitPreview = detail.lineItems.reduce((acc: Map<Id<'categories'>, number>, item: any) => {
    if (!item.grocerySubCategoryId) return acc;
    const lineTotal =
      typeof item.lineTotal === 'number'
        ? item.lineTotal
        : typeof item.quantity === 'number' && typeof item.price === 'number'
          ? item.quantity * item.price
          : typeof item.price === 'number'
            ? item.price
            : 0;
    if (!lineTotal) return acc;
    const key = item.grocerySubCategoryId as Id<'categories'>;
    acc.set(key, (acc.get(key) ?? 0) + lineTotal);
    return acc;
  }, new Map());

  const currency = detail.receipt.currency ?? 'USD';

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <Pressable onPress={() => router.back()}>
        <ThemedText type="link">{t(language, 'viewAll')}</ThemedText>
      </Pressable>

      <ThemedView style={{ gap: spacing.xs + 2 }}>
        <ThemedText type="title">{detail.receipt.merchantName ?? 'Receipt'}</ThemedText>
        <View style={styles.headerRow}>
          <ThemedText>{detail.receipt.receiptDate ?? ''}</ThemedText>
          {typeof detail.receipt.totalAmount === 'number' ? (
            <ThemedText type="defaultSemiBold">
              {formatMoney(detail.receipt.totalAmount, currency)}
            </ThemedText>
          ) : null}
        </View>
      </ThemedView>

      {detail.receipt.linkStatus === 'linkedMismatch' ? (
        <ThemedView style={[styles.card, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.error, gap: spacing.xs }]}>
          <ThemedText type="defaultSemiBold">{t(language, 'amountMismatch')}</ThemedText>
          <ThemedText>{t(language, 'receiptMismatchDetail')}</ThemedText>
          <Button onPress={onMarkReviewed} disabled={markingReviewed}>
            {t(language, 'markReviewed')}
          </Button>
        </ThemedView>
      ) : null}

      {detail.imageUrl ? (
        <Image source={{ uri: detail.imageUrl }} style={[styles.image, { borderRadius: borderRadius.lg, backgroundColor: colors.borderLight }]} resizeMode="contain" />
      ) : (
        <ThemedText>{t(language, 'noReceiptImage')}</ThemedText>
      )}

      <ThemedView style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'items')}</ThemedText>
        {detail.lineItems.length ? (
          <ThemedView style={{ gap: spacing.sm }}>
            {detail.lineItems.map((item) => (
              <ThemedView key={item._id} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight, gap: spacing.sm }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  {item.canonicalName && item.canonicalName !== item.name ? (
                    <ThemedText>{item.canonicalName}</ThemedText>
                  ) : null}
                  {item.needsReview ? (
                    <ThemedText>{t(language, 'needsReview')}</ThemedText>
                  ) : null}
                  <ThemedText style={{ color: colors.textMuted }}>
                    {t(language, 'subcategory')}
                  </ThemedText>
                  {categoriesLoaded ? (
                    grocerySubcategories.length ? (
                      <View style={[styles.chipRow, { gap: spacing.xs }]}>
                        <Pressable
                          onPress={() => onSelectCategory(item, null)}
                          disabled={updatingItemId === item._id}
                          style={[
                            styles.chip,
                            {
                              borderColor: colors.border,
                              backgroundColor: item.grocerySubCategoryId ? 'transparent' : colors.accentMuted,
                            },
                          ]}
                        >
                          <ThemedText style={{ color: item.grocerySubCategoryId ? colors.textMuted : colors.text }}>
                            {t(language, 'uncategorized')}
                          </ThemedText>
                        </Pressable>
                        {grocerySubcategories.map((cat) => {
                          const isActive = item.grocerySubCategoryId === cat._id;
                          return (
                            <Pressable
                              key={cat._id}
                              onPress={() => onSelectCategory(item, cat._id)}
                              disabled={updatingItemId === item._id}
                              style={[
                                styles.chip,
                                {
                                  borderColor: colors.border,
                                  backgroundColor: isActive ? colors.accentMuted : 'transparent',
                                },
                              ]}
                            >
                              <ThemedText style={{ color: isActive ? colors.text : colors.textMuted }}>
                                {cat.name}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : (
                      <ThemedText>{t(language, 'noGrocerySubcategories')}</ThemedText>
                    )
                  ) : (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  {typeof item.quantity === 'number' ? (
                    <ThemedText>{`x${item.quantity}`}</ThemedText>
                  ) : null}
                  {typeof item.price === 'number' ? (
                    <ThemedText>{formatMoney(item.price, currency)}</ThemedText>
                  ) : null}
                </View>
              </ThemedView>
            ))}
          </ThemedView>
        ) : (
          <ThemedText>{t(language, 'noItems')}</ThemedText>
        )}
      </ThemedView>

      {splitPreview.size ? (
        <ThemedView style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'splitPreview')}</ThemedText>
          <ThemedView style={{ gap: spacing.xs }}>
            {Array.from(splitPreview.entries()).map(([categoryId, amount]) => (
              <ThemedView
                key={categoryId}
                style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}
              >
                <ThemedText>{categoryById.get(categoryId)?.name ?? t(language, 'subcategory')}</ThemedText>
                <ThemedText>{formatMoney(amount, currency)}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        </ThemedView>
      ) : null}

      <ThemedView style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'linkedTransaction')}</ThemedText>
        {detail.linkedTransaction ? (
          <ThemedView style={[styles.card, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight, gap: 4, ...shadows.sm }]}>
            <ThemedText type="defaultSemiBold">{detail.linkedTransaction.name}</ThemedText>
            <ThemedText>{detail.linkedTransaction.date}</ThemedText>
            <ThemedText>
              {formatMoney(detail.linkedTransaction.amount, detail.linkedTransaction.currency)}
            </ThemedText>
          </ThemedView>
        ) : (
          <ThemedText>{t(language, 'noLinkedTransaction')}</ThemedText>
        )}
      </ThemedView>

      <ThemedView style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'suggestedTransactions')}</ThemedText>
        {!candidates ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : candidates.length ? (
          <ThemedView style={{ gap: spacing.sm }}>
            {candidates.map((tx) => (
              <ThemedView key={tx._id} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight, gap: spacing.sm }]}>
                <View style={{ flex: 1, gap: 4 }}>
                  <ThemedText type="defaultSemiBold">{tx.name}</ThemedText>
                  <ThemedText>{tx.date}</ThemedText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <ThemedText>{formatMoney(tx.amount, tx.currency)}</ThemedText>
                  <Button onPress={() => onLink(tx._id)} disabled={linking === tx._id}>
                    {t(language, 'linkTransaction')}
                  </Button>
                </View>
              </ThemedView>
            ))}
          </ThemedView>
        ) : (
          <ThemedText>{t(language, 'noSuggestedTransactions')}</ThemedText>
        )}
      </ThemedView>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  image: {
    width: '100%',
    height: 240,
  },
  card: {
    borderWidth: 1,
  },
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
});
