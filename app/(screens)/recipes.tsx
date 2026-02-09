import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
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
import { createRecipe, listRecipes } from '@/lib/localDb';

export default function RecipesScreen() {
  const { language } = useSettings();
  const { owner, isReady, entitlements, isSignedIn } = useIdentity();
  const { bumpRefresh } = useLocalDb();
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [url, setUrl] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searching, setSearching] = React.useState(false);

  const recipes = useQuery(
    api.recipes.list,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const localRecipes = useLocalQuery(listRecipes, [], !isSignedIn);
  const importRecipe = useAction(api.recipes.importFromUrl);
  const createRecipeInternal = useMutation(api.recipes.createInternal);
  const searchOnline = useAction(api.recipes.searchOnline);

  const onImport = async () => {
    if (!owner) return;
    if (!entitlements.canUseAi) {
      if (!isSignedIn) {
        const newId = await createRecipe({ title: 'Recipe', content: '' });
        bumpRefresh();
        router.push({ pathname: '/(screens)/recipe/[recipeId]', params: { recipeId: newId } });
      } else {
        const newId = await createRecipeInternal({
          ownerType: owner.ownerType,
          ownerId: owner.ownerId,
          title: 'Recipe',
          content: '',
        });
        router.push({ pathname: '/(screens)/recipe/[recipeId]', params: { recipeId: newId } });
      }
      return;
    }
    if (!url.trim()) return;
    await importRecipe({ ownerType: owner.ownerType, ownerId: owner.ownerId, url: url.trim() });
    setUrl('');
  };

  const onSearch = async () => {
    if (!owner || !searchQuery.trim() || !entitlements.canUseAi) return;
    setSearching(true);
    try {
      const results = await searchOnline({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        query: searchQuery.trim(),
      });
      setSearchResults(Array.isArray(results) ? results : []);
    } finally {
      setSearching(false);
    }
  };

  const onImportResult = async (sourceUrl?: string | null) => {
    if (!owner || !sourceUrl) return;
    await importRecipe({ ownerType: owner.ownerType, ownerId: owner.ownerId, url: sourceUrl });
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
      <ThemedText type="title">{t(language, 'recipes')}</ThemedText>

      {entitlements.canUseAi ? (
        <ThemedView style={[styles.row, { gap: spacing.sm }]}>
          <TextInput
            style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
          />
          <Button onPress={onImport} disabled={!entitlements.canUseAi}>
            {t(language, 'addRecipe')}
          </Button>
        </ThemedView>
      ) : (
        <ThemedView style={[styles.row, { gap: spacing.sm }]}>
          <Button onPress={onImport}>{t(language, 'addRecipe')}</Button>
        </ThemedView>
      )}

      {entitlements.canUseAi ? (
        <ThemedView style={{ gap: spacing.sm }}>
          <ThemedText type="subtitle">{t(language, 'searchRecipes')}</ThemedText>
          <ThemedView style={[styles.row, { gap: spacing.sm }]}>
            <TextInput
              style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t(language, 'search')}
              placeholderTextColor={colors.textMuted}
            />
            <Button onPress={onSearch} disabled={!entitlements.canUseAi || searching}>
              {t(language, 'search')}
            </Button>
          </ThemedView>

          {searching ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : searchResults.length ? (
            <ThemedView style={{ gap: spacing.sm }}>
              {searchResults.map((result) => (
                <ThemedView key={result.id ?? result.title} style={[styles.rowItem, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                  <ThemedText>{result.title}</ThemedText>
                  <TouchableOpacity
                    onPress={() => onImportResult(result.sourceUrl)}
                    disabled={!result.sourceUrl || !entitlements.canUseAi}
                    style={[styles.pill, { borderRadius: borderRadius.pill, borderColor: colors.border }]}
                  >
                    <ThemedText style={typography.label}>{t(language, 'addRecipe')}</ThemedText>
                  </TouchableOpacity>
                </ThemedView>
              ))}
            </ThemedView>
          ) : searchQuery.trim().length ? (
            <ThemedText>{t(language, 'noRecipesFound')}</ThemedText>
          ) : null}
        </ThemedView>
      ) : null}

      {isSignedIn ? !recipes : !localRecipes.data ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (isSignedIn ? recipes : localRecipes.data)!.length ? (
        <ThemedView style={{ gap: spacing.sm }}>
          {(isSignedIn ? recipes : localRecipes.data)!.map((recipe: any) => (
            <TouchableOpacity
              key={recipe._id ?? recipe.id}
              onPress={() =>
                router.push({
                  pathname: '/(screens)/recipe/[recipeId]',
                  params: { recipeId: recipe._id ?? recipe.id },
                })
              }
            >
              <ThemedView style={[styles.rowItem, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                <ThemedText>{recipe.title}</ThemedText>
                <ThemedText>
                  {recipe.servings ? `${recipe.servings} ${t(language, 'servings')}` : ''}
                </ThemedText>
              </ThemedView>
            </TouchableOpacity>
          ))}
        </ThemedView>
      ) : (
        <ThemedText>{t(language, 'noRecipes')}</ThemedText>
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
    alignItems: 'center',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
});
