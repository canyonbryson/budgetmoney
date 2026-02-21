import React from 'react';
import Constants from 'expo-constants';
import { ActivityIndicator, NativeModules, Platform, StyleSheet, TurboModuleRegistry, View } from 'react-native';
import { useAction, useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { LinkExit, LinkLogLevel, LinkSuccess, create, open } from 'react-native-plaid-link-sdk';

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
import type { Id } from '@/convex/_generated/dataModel';
import { formatMoney } from '@/lib/money';

type AccountRole = 'checking' | 'savings' | 'investment' | 'liability';

const ROLE_OPTIONS: AccountRole[] = ['checking', 'savings', 'investment', 'liability'];

function inferRole(type?: string | null, subtype?: string | null): AccountRole {
  const t = type?.toLowerCase().trim() ?? '';
  const s = subtype?.toLowerCase().trim() ?? '';
  if (t === 'credit' || t === 'loan') return 'liability';
  if (t === 'investment') return 'investment';
  if (s === 'savings' || s === 'money market') return 'savings';
  if (s === 'credit card' || s === 'mortgage' || s === 'student') return 'liability';
  return 'checking';
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

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
  const updateAccountPreferences = useMutation(api.plaid.updateAccountPreferences);
  const [linkLoading, setLinkLoading] = React.useState(false);
  const [linkError, setLinkError] = React.useState<string | null>(null);
  const [savingAccountId, setSavingAccountId] = React.useState<string | null>(null);
  const isWeb = Platform.OS === 'web';
  const isExpoGo = Constants.appOwnership === 'expo';
  const plaidModuleName = Platform.OS === 'ios' ? 'RNLinksdk' : Platform.OS === 'android' ? 'PlaidAndroid' : null;
  const buckets = useQuery(
    api.netWorth.listBuckets,
    owner && entitlements.canUsePlaid && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const hasPlaidNativeModule = React.useMemo(() => {
    if (!plaidModuleName) return false;
    const turbo = Boolean((TurboModuleRegistry as any).get?.(plaidModuleName));
    const classic = Boolean((NativeModules as Record<string, unknown>)[plaidModuleName]);
    return turbo || classic;
  }, [plaidModuleName]);
  const groupedAccounts = React.useMemo(() => {
    const groups: Record<AccountRole, typeof accounts extends Array<infer T> ? T[] : any[]> = {
      checking: [],
      savings: [],
      investment: [],
      liability: [],
    };
    if (!accounts) return groups;
    for (const account of accounts) {
      const role = (account.netWorthRole ?? inferRole(account.type, account.subtype)) as AccountRole;
      groups[role].push(account);
    }
    return groups;
  }, [accounts]);

  const onUpdatePreferences = async (plaidAccountId: string, payload: {
    netWorthRole?: AccountRole;
    includeInBudget?: boolean;
    includeInNetWorth?: boolean;
    netWorthBucketId?: Id<'netWorthBuckets'> | null;
  }) => {
    if (!owner) return;
    try {
      setSavingAccountId(plaidAccountId);
      await updateAccountPreferences({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        plaidAccountId,
        ...payload,
      });
    } finally {
      setSavingAccountId(null);
    }
  };

  const onConnect = async () => {
    console.log('[Plaid][connect] pressed', {
      platform: Platform.OS,
      isExpoGo,
      hasPlaidNativeModule,
      plaidModuleName,
      ownerReady: Boolean(owner),
      isSignedIn,
    });
    if (!owner || !isSignedIn) return;
    try {
      setLinkLoading(true);
      setLinkError(null);
      if (isExpoGo || !hasPlaidNativeModule) {
        const message =
          'Plaid Link requires a native development build. Expo Go cannot open the Plaid SDK. Build and run a dev client, then try again.';
        console.error('[Plaid][connect] blocked - native module unavailable', {
          isExpoGo,
          hasPlaidNativeModule,
          plaidModuleName,
        });
        setLinkError(message);
        return;
      }
      const result = await createLinkToken({ ownerType: owner.ownerType, ownerId: owner.ownerId });
      console.log('[Plaid][connect] createLinkToken success', {
        tokenLength: result.link_token?.length ?? 0,
      });
      create({ token: result.link_token, logLevel: LinkLogLevel.DEBUG });
      console.log('[Plaid][connect] native create() invoked');
      await open({ onSuccess, onExit, logLevel: LinkLogLevel.DEBUG });
      console.log('[Plaid][connect] native open() returned');
    } catch (err: any) {
      console.error('[Plaid][connect] failed', {
        message: err?.message,
        error: err,
      });
      setLinkError(err?.message ?? 'Failed to start Plaid Link.');
    } finally {
      setLinkLoading(false);
    }
  };

  const onSuccess = async (success: LinkSuccess) => {
    console.log('[Plaid][onSuccess]', {
      institution: success.metadata?.institution?.name,
      accountCount: success.metadata?.accounts?.length ?? 0,
      linkSessionId: success.metadata?.linkSessionId,
    });
    if (!owner) return;
    try {
      setLinkError(null);
      await exchangePublicToken({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        publicToken: success.publicToken,
        institutionName: success.metadata?.institution?.name ?? undefined,
      });
      console.log('[Plaid][onSuccess] exchangePublicToken success');
    } catch (err: any) {
      console.error('[Plaid][onSuccess] exchangePublicToken failed', {
        message: err?.message,
        error: err,
      });
      setLinkError(err?.message ?? 'Failed to link account.');
    }
  };

  const onExit = (exit: LinkExit) => {
    console.log('[Plaid][onExit]', {
      status: exit?.metadata?.status,
      institution: exit?.metadata?.institution?.name,
      linkSessionId: exit?.metadata?.linkSessionId,
      requestId: exit?.metadata?.requestId,
      errorCode: exit?.error?.errorCode,
      errorType: exit?.error?.errorType,
      errorMessage: exit?.error?.errorMessage,
      displayMessage: exit?.error?.displayMessage,
    });
    if (exit?.error?.displayMessage) {
      setLinkError(exit.error.displayMessage);
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
          <Button variant="outline" onPress={() => router.push('/(screens)/net-worth')}>
            Net worth details
          </Button>
          {!isWeb && (isExpoGo || !hasPlaidNativeModule) ? (
            <ThemedText style={{ color: colors.error }}>
              Plaid native module is unavailable in this runtime. Use a native dev build (not Expo Go).
            </ThemedText>
          ) : null}
          {isWeb ? (
            <Button onPress={() => {}} disabled>
              {t(language, 'connectBank')}
            </Button>
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
            <ThemedView style={{ gap: spacing.md }}>
              {ROLE_OPTIONS.map((role) => (
                <ThemedView
                  key={role}
                  style={[
                    styles.card,
                    {
                      padding: spacing.md,
                      borderRadius: borderRadius.md,
                      borderColor: colors.borderLight,
                      gap: spacing.sm,
                      ...shadows.sm,
                    },
                  ]}
                >
                  <ThemedText type="defaultSemiBold">
                    {titleCase(role)} ({groupedAccounts[role].length})
                  </ThemedText>
                  {groupedAccounts[role].length ? groupedAccounts[role].map((acct) => {
                    const accountRole = (acct.netWorthRole ?? inferRole(acct.type, acct.subtype)) as AccountRole;
                    const includeInBudget = acct.includeInBudget ?? accountRole === 'checking';
                    const includeInNetWorth = acct.includeInNetWorth ?? true;
                    const isSaving = savingAccountId === acct.plaidAccountId;
                    const balance = typeof acct.currentBalance === 'number' ? acct.currentBalance : (acct.availableBalance ?? 0);
                    return (
                      <ThemedView
                        key={acct._id}
                        style={[
                          styles.accountCard,
                          {
                            padding: spacing.sm,
                            borderRadius: borderRadius.sm,
                            borderColor: colors.borderLight,
                            gap: spacing.sm,
                          },
                        ]}
                      >
                        <View style={styles.summaryRow}>
                          <ThemedText type="defaultSemiBold">{acct.name}</ThemedText>
                          <ThemedText>{formatMoney(balance)}</ThemedText>
                        </View>
                        <ThemedText style={{ color: colors.textSecondary }}>
                          {acct.mask ?? ''} {acct.type ? `· ${acct.type}` : ''} {acct.subtype ? `· ${acct.subtype}` : ''}
                        </ThemedText>
                        <View style={[styles.rowButtons, { gap: spacing.xs }]}>
                          {ROLE_OPTIONS.map((option) => (
                            <Button
                              key={option}
                              variant={option === accountRole ? 'primary' : 'outline'}
                              size="sm"
                              disabled={isSaving}
                              onPress={() =>
                                onUpdatePreferences(acct.plaidAccountId, {
                                  netWorthRole: option,
                                  includeInBudget: option === 'checking',
                                })
                              }
                            >
                              {titleCase(option)}
                            </Button>
                          ))}
                        </View>
                        <View style={[styles.rowButtons, { gap: spacing.xs }]}>
                          <Button
                            variant={includeInBudget ? 'primary' : 'outline'}
                            size="sm"
                            disabled={isSaving || accountRole !== 'checking'}
                            onPress={() =>
                              onUpdatePreferences(acct.plaidAccountId, {
                                includeInBudget: !includeInBudget,
                              })
                            }
                          >
                            {includeInBudget ? 'In budget' : 'Out of budget'}
                          </Button>
                          <Button
                            variant={includeInNetWorth ? 'primary' : 'outline'}
                            size="sm"
                            disabled={isSaving}
                            onPress={() =>
                              onUpdatePreferences(acct.plaidAccountId, {
                                includeInNetWorth: !includeInNetWorth,
                              })
                            }
                          >
                            {includeInNetWorth ? 'In net worth' : 'Out of net worth'}
                          </Button>
                        </View>
                        {(accountRole === 'savings' || accountRole === 'investment') && (
                          <View style={[styles.rowButtons, { gap: spacing.xs }]}>
                            <Button
                              variant={!acct.netWorthBucketId ? 'primary' : 'outline'}
                              size="sm"
                              disabled={isSaving}
                              onPress={() =>
                                onUpdatePreferences(acct.plaidAccountId, {
                                  netWorthBucketId: null,
                                })
                              }
                            >
                              Unbucketed
                            </Button>
                            {(buckets ?? [])
                              .filter((bucket) => bucket.role === accountRole)
                              .map((bucket) => (
                                <Button
                                  key={bucket._id}
                                  variant={bucket._id === acct.netWorthBucketId ? 'primary' : 'outline'}
                                  size="sm"
                                  disabled={isSaving}
                                  onPress={() =>
                                    onUpdatePreferences(acct.plaidAccountId, {
                                      netWorthBucketId: bucket._id,
                                    })
                                  }
                                >
                                  {bucket.name}
                                </Button>
                              ))}
                          </View>
                        )}
                        {isSaving ? <ActivityIndicator size="small" color={colors.primary} /> : null}
                      </ThemedView>
                    );
                  }) : <ThemedText style={{ color: colors.textSecondary }}>No {role} accounts</ThemedText>}
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
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountCard: {
    borderWidth: 1,
  },
});
