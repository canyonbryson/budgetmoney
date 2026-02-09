import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';
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

export default function PantryScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius } = useAppTheme();
  const [name, setName] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [unit, setUnit] = React.useState('');
  const [importing, setImporting] = React.useState(false);

  const items = useQuery(
    api.pantry.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const addItem = useMutation(api.pantry.add);
  const generateUploadUrl = useMutation(api.pantry.generateUploadUrl);
  const importFromPhoto = useAction(api.pantry.importFromPhoto);

  const onAdd = async () => {
    if (!owner || !name.trim() || !isSignedIn) return;
    const parsedQuantity = quantity.trim() ? Number.parseFloat(quantity) : undefined;
    await addItem({
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      name: name.trim(),
      quantity: Number.isFinite(parsedQuantity) ? parsedQuantity : undefined,
      unit: unit.trim() || undefined,
    });
    setName('');
    setQuantity('');
    setUnit('');
  };

  const onImport = async () => {
    if (!owner || !entitlements.canUseAi || !isSignedIn) return;
    setImporting(true);
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

      await importFromPhoto({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        storageId,
      });
    } finally {
      setImporting(false);
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
      <ThemedText type="title">{t(language, 'pantry')}</ThemedText>

      <ThemedView style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={name}
          onChangeText={setName}
          placeholder={t(language, 'addItem')}
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={quantity}
          onChangeText={setQuantity}
          placeholder={t(language, 'quantity')}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <TextInput
          style={[styles.input, styles.inputCompact, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          value={unit}
          onChangeText={setUnit}
          placeholder={t(language, 'unit')}
          placeholderTextColor={colors.textMuted}
        />
        <Button onPress={onAdd}>{t(language, 'save')}</Button>
      </ThemedView>

      <Button onPress={onImport} disabled={!entitlements.canUseAi || importing}>
        {t(language, 'importPantry')}
      </Button>

      {!items ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : items.length ? (
        <ThemedView style={{ gap: spacing.sm }}>
          {items.map((item) => (
            <ThemedView key={item._id} style={[styles.rowItem, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
              <ThemedText>{item.name}</ThemedText>
              <ThemedText>
                {item.quantity !== undefined && item.quantity !== null
                  ? item.unit
                    ? `${item.quantity} ${item.unit}`
                    : String(item.quantity)
                  : ''}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noPantry')}</ThemedText>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  rowItem: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputCompact: {
    minWidth: 90,
    flex: 0.5,
  },
});
