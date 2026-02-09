import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
import {
  createCategory as createLocalCategory,
  getCategories,
  removeCategory as removeLocalCategory,
  updateCategory as updateLocalCategory,
} from '@/lib/localDb';
import type { Id } from '@/convex/_generated/dataModel';

export default function CategoriesScreen() {
  const { language } = useSettings();
  const { owner, isReady, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, shadows, typography } = useAppTheme();
  const [name, setName] = React.useState('');
  const [selectedParentId, setSelectedParentId] = React.useState<Id<'categories'> | null>(null);
  const [editingId, setEditingId] = React.useState<Id<'categories'> | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const categories = useQuery(
    api.categories.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localCategories = useLocalQuery(getCategories, [], !isSignedIn);
  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);

  const topLevel = React.useMemo(
    () => ((isSignedIn ? categories : localCategories.data) ?? []).filter((cat) => !cat.parentId),
    [categories, localCategories.data, isSignedIn]
  );

  const childrenByParent = React.useMemo(() => {
    const list = (isSignedIn ? categories : localCategories.data) ?? [];
    const map = new Map<Id<'categories'>, typeof list>();
    list.forEach((cat) => {
      if (!cat.parentId) return;
      const list = map.get(cat.parentId) ?? [];
      list.push(cat);
      map.set(cat.parentId, list);
    });
    return map;
  }, [categories, localCategories.data, isSignedIn]);

  const resetForm = () => {
    setName('');
    setSelectedParentId(null);
    setEditingId(null);
  };

  const onSave = async () => {
    if (!owner) return;
    const trimmed = name.trim();
    if (!trimmed.length) return;
    setSaving(true);
    setError(null);
    try {
      if (!isSignedIn) {
        if (editingId) {
          await updateLocalCategory(editingId, trimmed, selectedParentId ?? null);
        } else {
          await createLocalCategory(trimmed, selectedParentId ?? null);
        }
        bumpRefresh();
      } else {
        if (editingId) {
          await updateCategory({
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            id: editingId,
            name: trimmed,
            parentId: selectedParentId ?? undefined,
          });
        } else {
          await createCategory({
            ownerType: owner.ownerType,
            ownerId: owner.ownerId,
            name: trimmed,
            parentId: selectedParentId ?? undefined,
          });
        }
      }
      resetForm();
    } catch (err: any) {
      setError(err?.message ?? t(language, 'saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (category: any) => {
    setEditingId(category._id);
    setName(category.name ?? '');
    setSelectedParentId(category.parentId ?? null);
    setError(null);
  };

  const onCancel = () => {
    resetForm();
    setError(null);
  };

  const onDelete = async (category: any) => {
    if (!owner) return;
    setSaving(true);
    setError(null);
    try {
      if (!isSignedIn) {
        await removeLocalCategory(category._id);
        bumpRefresh();
      } else {
        await removeCategory({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          id: category._id,
        });
      }
      if (editingId === category._id) resetForm();
    } catch (err: any) {
      setError(err?.message ?? t(language, 'deleteFailed'));
    } finally {
      setSaving(false);
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
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'categories')}</ThemedText>

      <ThemedView style={[styles.card, { gap: spacing.sm + 2, padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.borderLight, ...shadows.sm }]}>
        <ThemedText type="subtitle">
          {editingId ? t(language, 'edit') : t(language, 'addCategory')}
        </ThemedText>
        <TextInput
          style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
          placeholder={t(language, 'categoryName')}
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />

        <ThemedText>{t(language, 'parentCategory')}</ThemedText>
        <ThemedView style={[styles.parentRow, { gap: spacing.sm }]}>
          <TouchableOpacity
            onPress={() => setSelectedParentId(null)}
            style={[
              styles.pill,
              { borderRadius: borderRadius.pill, borderColor: colors.border },
              selectedParentId === null && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
            ]}
          >
            <ThemedText
              style={selectedParentId === null
                ? { ...typography.caption, fontWeight: '600' }
                : typography.caption}
            >
              {t(language, 'topLevel')}
            </ThemedText>
          </TouchableOpacity>
          {topLevel.map((cat) => {
            const isActive = selectedParentId === cat._id;
            return (
              <TouchableOpacity
                key={cat._id}
                onPress={() => setSelectedParentId(cat._id)}
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.border },
                  isActive && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
              >
                <ThemedText
                  style={isActive
                    ? { ...typography.caption, fontWeight: '600' }
                    : typography.caption}
                >
                  {cat.name}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ThemedView>

        <ThemedView style={[styles.editorActions, { gap: spacing.sm }]}>
          <Button onPress={onSave} disabled={saving || !name.trim().length}>
            {t(language, 'save')}
          </Button>
          {editingId ? (
            <Button onPress={onCancel} disabled={saving}>
              {t(language, 'cancel')}
            </Button>
          ) : null}
        </ThemedView>

        {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
      </ThemedView>

      {isSignedIn ? !categories : !localCategories.data ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (isSignedIn ? categories : localCategories.data)!.length ? (
        <ThemedView style={{ gap: spacing.md }}>
          {topLevel.map((cat) => {
            const children = childrenByParent.get(cat._id) ?? [];
            return (
              <ThemedView key={cat._id} style={[styles.card, { gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                <View style={[styles.categoryRow, { gap: spacing.sm }]}>
                  <ThemedText type="defaultSemiBold">{cat.name}</ThemedText>
                  <View style={[styles.categoryActions, { gap: spacing.sm }]}>
                    <Button onPress={() => onEdit(cat)} disabled={saving}>
                      {t(language, 'edit')}
                    </Button>
                    <Button onPress={() => onDelete(cat)} disabled={saving || cat.isDefault}>
                      {t(language, 'delete')}
                    </Button>
                  </View>
                </View>
                {children.length ? (
                  <ThemedView style={{ gap: spacing.sm, paddingLeft: spacing.md }}>
                    {children.map((child) => (
                      <View key={child._id} style={[styles.categoryRow, { gap: spacing.sm }]}>
                        <ThemedText>{child.name}</ThemedText>
                        <View style={[styles.categoryActions, { gap: spacing.sm }]}>
                          <Button onPress={() => onEdit(child)} disabled={saving}>
                            {t(language, 'edit')}
                          </Button>
                          <Button
                            onPress={() => onDelete(child)}
                            disabled={saving || child.isDefault}
                          >
                            {t(language, 'delete')}
                          </Button>
                        </View>
                      </View>
                    ))}
                  </ThemedView>
                ) : null}
              </ThemedView>
            );
          })}
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noCategories')}</ThemedText>
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
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  parentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  editorActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryActions: {
    flexDirection: 'row',
  },
});
