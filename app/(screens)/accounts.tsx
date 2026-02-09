import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { PlaidLink } from 'react-native-plaid-link-sdk';

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

export default function AccountsScreen() {
  const { language } = useSettings();
  const { owner, entitlements, isReady, isSignedIn } = useIdentity();
  const { colors, spacing, borderRadius, shadows } = useAppTheme();
  const items = useQuery(
    api.plaid.listItems,
    owner && entitlements.canUsePlaid && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const accounts = useQuery(
    api.plaid.listAccounts,
    owner && entitlements.canUsePlaid && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );

  const createLinkToken = useAction(api.plaid.createLinkToken);
  const exchangePublicToken = useAction(api.plaid.exchangePublicToken);
  const [linkToken, setLinkToken] = React.useState<string | null>(null);
  const [linkLoading, setLinkLoading] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const isWeb = Platform.OS === 'web';

  const onConnect = async () => {
    if (!owner || !isSignedIn) return;
    try {
      setLinkLoading(true);
      setLinkError(null);
      const result = await createLinkToken({ ownerType: owner.ownerType, ownerId: owner.ownerId });
      setLinkToken(result.link_token);
    } catch (err: any) {
      setLinkError(err?.message ?? 'Failed to start Plaid Link.');
    } finally {
      setLinkLoading(false);
    }
  };

  const onSuccess = async (success: { publicToken: string; metadata?: { institution?: { name?: string } } }) => {
    if (!owner) return;
    try {
      setLinkError(null);
      await exchangePublicToken({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        publicToken: success.publicToken,
        institutionName: success.metadata?.institution?.name ?? undefined,
      });
      setLinkToken(null);
    } catch (err: any) {
      setLinkError(err?.message ?? 'Failed to link account.');
    }
  };

  const onExit = (_exit: { error?: { displayMessage?: string } }) => {
    if (_exit?.error?.displayMessage) {
      setLinkError(_exit.error.displayMessage);
    }
    setLinkToken(null);
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
      <ThemedText type="title">{t(language, 'accounts')}</ThemedText>

      {!entitlements.canUsePlaid && (
        <ThemedView style={[styles.card, { padding: spacing.md, borderRadius: borderRadius.md, borderColor: colors.border, gap: spacing.sm, ...shadows.sm }]}>
          <ThemedText>{t(language, 'anonymousBanner')}</ThemedText>
          <View style={[styles.rowButtons, { gap: spacing.sm }]}>
            <Button onPress={() => {}} disabled>
              {t(language, 'connectBank')}
            </Button>
            <Button onPress={() => router.push('/sign-in')}>
              {t(language, 'signIn')}
            </Button>
          </View>
        </ThemedView>
      )}

      {entitlements.canUsePlaid && (
        <>
          {isWeb ? (
            <Button onPress={() => {}} disabled>
              {t(language, 'connectBank')}
            </Button>
          ) : linkToken ? (
            <PlaidLink tokenConfig={{ token: linkToken }} onSuccess={onSuccess} onExit={onExit}>
              <Button onPress={() => {}}>{t(language, 'connectBank')}</Button>
            </PlaidLink>
          ) : (
            <Button onPress={onConnect} disabled={!entitlements.canUsePlaid || linkLoading}>
              {t(language, 'connectBank')}
            </Button>
          )}
          {linkError ? <ThemedText style={{ color: colors.error }}>{linkError}</ThemedText> : null}
        </>
      )}

      {entitlements.canUsePlaid && (
        <>
          <ThemedText type="subtitle">{t(language, 'items')}</ThemedText>
          {!items ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : items.length ? (
            <ThemedView style={{ gap: spacing.sm }}>
              {items.map((item) => (
                <ThemedView key={item._id} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                  <ThemedText>{item.institutionName ?? item.plaidItemId}</ThemedText>
                  <ThemedText>{item.status}</ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : (
            <ThemedText>{t(language, 'noItems')}</ThemedText>
          )}

          <ThemedText type="subtitle">{t(language, 'accounts')}</ThemedText>
          {!accounts ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : accounts.length ? (
            <ThemedView style={{ gap: spacing.sm }}>
              {accounts.map((acct) => (
                <ThemedView key={acct._id} style={[styles.row, { padding: spacing.sm + 2, borderRadius: borderRadius.md, borderColor: colors.borderLight }]}>
                  <ThemedText>{acct.name}</ThemedText>
                  <ThemedText>{acct.mask ?? acct.subtype ?? ''}</ThemedText>
                </ThemedView>
              ))}
            </ThemedView>
          ) : (
            <ThemedText>{t(language, 'noAccounts')}</ThemedText>
          )}
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
  row: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
