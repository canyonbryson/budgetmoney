import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import ScreenScrollView from '@/components/ScreenScrollView';
import ScreenWrapper from '@/components/ScreenWrapper';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { formatMoney } from '@/lib/money';

export default function ReceiptsScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, shadows } = useAppTheme();
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<
    Record<string, { name: string; quantity: string; price: string }>
  >({});
  const [saving, setSaving] = React.useState<Record<string, boolean>>({});
  const [uploading, setUploading] = React.useState(false);

  const receipts = useQuery(
    api.receipts.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const reviewItems = useQuery(
    api.receipts.listNeedsReview,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const reviewReceipts = useQuery(
    api.receipts.listReceiptsNeedingReview,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const updateLineItem = useMutation(api.receipts.updateLineItem);
  const generateUploadUrl = useMutation(api.receipts.generateUploadUrl);
  const createFromUpload = useMutation(api.receipts.createFromUpload);
  const parseReceipt = useAction(api.receipts.parse);

  const resolvedReviewItems = isSignedIn ? (reviewItems ?? []) : [];
  const resolvedReviewReceipts = isSignedIn ? (reviewReceipts ?? []) : [];
  const resolvedReceipts = isSignedIn ? (receipts ?? []) : [];

  React.useEffect(() => {
    if (!__DEV__) return;
    console.info('[Receipts]', {
      isReady,
      isSignedIn,
      owner,
      receipts,
      reviewItems,
      reviewReceipts,
    });
  }, [isReady, isSignedIn, owner, receipts, reviewItems, reviewReceipts]);

  const getDraft = React.useCallback(
    (item: any, currentDrafts = drafts) =>
      currentDrafts[item._id] ?? {
        name: item.name ?? '',
        quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '',
        price: item.price !== undefined && item.price !== null ? String(item.price) : '',
      },
    [drafts]
  );

  const onSaveReview = async (item: any) => {
    if (!owner) return;
    const draft = getDraft(item);
    const name = draft.name.trim() || item.name;
    const fallbackQuantity = typeof item.quantity === 'number' ? item.quantity : undefined;
    const fallbackPrice = typeof item.price === 'number' ? item.price : undefined;
    const quantity = draft.quantity.trim()
      ? Number.parseFloat(draft.quantity)
      : fallbackQuantity;
    const price = draft.price.trim() ? Number.parseFloat(draft.price) : fallbackPrice;

    setSaving((prev) => ({ ...prev, [item._id]: true }));
    try {
      await updateLineItem({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        lineItemId: item._id,
        name,
        quantity: Number.isFinite(quantity) ? quantity : fallbackQuantity,
        price: Number.isFinite(price) ? price : fallbackPrice,
        markReviewed: true,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item._id];
        return next;
      });
    } finally {
      setSaving((prev) => ({ ...prev, [item._id]: false }));
    }
  };

  const onAddReceipt = async () => {
    if (!owner || !entitlements.canUseAi || !isSignedIn) return;
    setUploading(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return;
      }

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

  const linkedReceipts = resolvedReceipts.filter((rec) => rec.linkedTransactionId);
  const unlinkedReceipts = resolvedReceipts.filter((rec) => !rec.linkedTransactionId);
  const reviewLoading = isSignedIn && (reviewItems === undefined || reviewReceipts === undefined);

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.md }]}>
      <ThemedText type="title">{t(language, 'receipts')}</ThemedText>
      {!isSignedIn ? (
        <ThemedText>{t(language, 'upgradeToUnlock')} {t(language, 'receipts')}</ThemedText>
      ) : null}
      <Button onPress={onAddReceipt} disabled={!entitlements.canUseAi || uploading || !isSignedIn}>
        {t(language, 'addReceipt')}
      </Button>

      <ThemedView style={{ gap: spacing.sm }}>
        <ThemedText type="subtitle">{t(language, 'needsReview')}</ThemedText>
        {!isSignedIn ? (
          <ThemedText>{t(language, 'noItemsToReview')}</ThemedText>
        ) : reviewLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : resolvedReviewReceipts.length || resolvedReviewItems.length ? (
          <ThemedView style={{ gap: spacing.sm }}>
            {resolvedReviewReceipts.length ? (
              <ThemedView style={{ gap: spacing.sm }}>
                {resolvedReviewReceipts.map((rec) => (
                  <Pressable
                    key={rec._id}
                    onPress={() =>
                      router.push({
                        pathname: '/(screens)/receipt/[receiptId]',
                        params: { receiptId: rec._id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText type="defaultSemiBold">{rec.merchantName ?? 'Receipt'}</ThemedText>
                      <ThemedText>{rec.receiptDate ?? ''}</ThemedText>
                      {rec.linkStatus === 'linkedMismatch' ? (
                        <ThemedText style={{ color: colors.error }}>{t(language, 'amountMismatch')}</ThemedText>
                      ) : null}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <ThemedText>
                        {typeof rec.totalAmount === 'number'
                          ? formatMoney(rec.totalAmount, rec.currency ?? 'USD')
                          : ''}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </ThemedView>
            ) : null}

            {resolvedReviewItems.length ? (
              <ThemedView style={{ gap: spacing.sm }}>
                {resolvedReviewItems.map((item) => {
                  const draft = getDraft(item);
                  return (
                    <ThemedView key={item._id} style={[styles.card, { padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.borderLight, gap: spacing.sm, ...shadows.sm }]}>
                      <View style={styles.reviewHeader}>
                        <ThemedText type="defaultSemiBold">
                          {item.receipt?.merchantName ?? 'Receipt'}
                        </ThemedText>
                        <ThemedText>{item.receipt?.receiptDate ?? ''}</ThemedText>
                      </View>
                      <TextInput
                        style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                        value={draft.name}
                        onChangeText={(val) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item._id]: { ...getDraft(item, prev), name: val },
                          }))
                        }
                        placeholder={t(language, 'itemName')}
                        placeholderTextColor={colors.textMuted}
                      />
                      <View style={[styles.reviewRow, { gap: spacing.sm }]}>
                        <TextInput
                          style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                          value={draft.quantity}
                          onChangeText={(val) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item._id]: { ...getDraft(item, prev), quantity: val },
                            }))
                          }
                          placeholder={t(language, 'quantity')}
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                        <TextInput
                          style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                          value={draft.price}
                          onChangeText={(val) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [item._id]: { ...getDraft(item, prev), price: val },
                            }))
                          }
                          placeholder={t(language, 'price')}
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                        <Button onPress={() => onSaveReview(item)} disabled={saving[item._id]}>
                          {t(language, 'save')}
                        </Button>
                      </View>
                    </ThemedView>
                  );
                })}
              </ThemedView>
            ) : null}
          </ThemedView>
        ) : (
          <ThemedText>{t(language, 'noItemsToReview')}</ThemedText>
        )}
      </ThemedView>

      {!isSignedIn ? (
        <ThemedText>{t(language, 'noReceipts')}</ThemedText>
      ) : !receipts ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : resolvedReceipts.length ? (
        <>
          <ThemedView style={{ gap: spacing.sm }}>
            <ThemedText type="subtitle">{t(language, 'linkedReceipts')}</ThemedText>
            {linkedReceipts.length ? (
              <ThemedView style={{ gap: spacing.sm }}>
                {linkedReceipts.map((rec) => (
                  <Pressable
                    key={rec._id}
                    onPress={() =>
                      router.push({
                        pathname: '/(screens)/receipt/[receiptId]',
                        params: { receiptId: rec._id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <ThemedText>{rec.merchantName ?? 'Receipt'}</ThemedText>
                      {rec.linkStatus === 'linkedMismatch' ? (
                        <ThemedText style={{ color: colors.error }}>{t(language, 'amountMismatch')}</ThemedText>
                      ) : null}
                    </View>
                    <ThemedText>
                      {typeof rec.totalAmount === 'number'
                        ? formatMoney(rec.totalAmount, rec.currency ?? 'USD')
                        : ''}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            ) : (
              <ThemedText>{t(language, 'noReceipts')}</ThemedText>
            )}
          </ThemedView>

          <ThemedView style={{ gap: spacing.sm }}>
            <ThemedText type="subtitle">{t(language, 'unlinkedReceipts')}</ThemedText>
            {unlinkedReceipts.length ? (
              <ThemedView style={{ gap: spacing.sm }}>
                {unlinkedReceipts.map((rec) => (
                  <Pressable
                    key={rec._id}
                    onPress={() =>
                      router.push({
                        pathname: '/(screens)/receipt/[receiptId]',
                        params: { receiptId: rec._id },
                      })
                    }
                    style={({ pressed }) => [
                      styles.row,
                      { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight },
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <ThemedText>{rec.merchantName ?? 'Receipt'}</ThemedText>
                    <ThemedText>
                      {typeof rec.totalAmount === 'number'
                        ? formatMoney(rec.totalAmount, rec.currency ?? 'USD')
                        : ''}
                    </ThemedText>
                  </Pressable>
                ))}
              </ThemedView>
            ) : (
              <ThemedText>{t(language, 'noReceipts')}</ThemedText>
            )}
          </ThemedView>
        </>
      ) : (
        <ThemedText>{t(language, 'noReceipts')}</ThemedText>
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
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  inputCompact: {
    flex: 1,
  },
});
