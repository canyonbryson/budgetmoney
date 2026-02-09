import React from 'react';
import { StyleSheet, View, Pressable, ScrollView, TextInput, Switch } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { Ionicons } from '@expo/vector-icons';

import ScreenScrollView from '@/components/ScreenScrollView';
import { ThemedText } from '@/components/ThemedText';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { useIdentity } from '@/contexts/IdentityContext';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';
import { api } from '@/convex/_generated/api';
import { themes, themeIds } from '@/constants/themes';
import type { ThemeId } from '@/constants/themes';

function ThemeSwatch({ themeId, isActive, onPress }: { themeId: ThemeId; isActive: boolean; onPress: () => void }) {
  const def = themes[themeId];
  const { colors, borderRadius, spacing, shadows, typography } = useAppTheme();
  const palette = def.colors.light;

  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          borderRadius: borderRadius.lg,
          padding: spacing.md,
          borderWidth: 2,
          borderColor: isActive ? colors.primary : colors.borderLight,
          backgroundColor: isActive ? colors.primaryMuted : colors.backgroundCard,
          width: 100,
          alignItems: 'center',
          gap: spacing.sm,
          ...shadows.sm,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[palette.primary, palette.accent, palette.success, palette.background].map((c, i) => (
          <View
            key={i}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: c,
              borderWidth: 1,
              borderColor: colors.borderLight,
            }}
          />
        ))}
      </View>
      <ThemedText style={[typography.caption, { fontWeight: isActive ? '700' : '400', color: isActive ? colors.primary : colors.textSecondary }]}>
        {def.displayName}
      </ThemedText>
    </Pressable>
  );
}

function SettingsNavRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const { colors, spacing, typography } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={[styles.navRow, { paddingVertical: spacing.md }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name={icon} size={20} color={colors.accent} />
        <ThemedText style={typography.body}>{label}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { user } = useUser();
  const { signOut, isSignedIn } = useAuth();
  const { language, setLanguage, theme, setTheme, brandTheme, setBrandTheme } = useSettings();
  const { entitlements, owner } = useIdentity();
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const clearAll = useMutation(api.data.clearAll);
  const bootstrapDefaults = useMutation(api.categories.bootstrapDefaults);
  const notificationSettings = useMutation(api.notifications.upsertSettings);
  const settingsData = useQuery(
    api.notifications.getSettings,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const creditCards = useQuery(
    api.notifications.listCreditCards,
    owner && isSignedIn ? { ownerType: owner.ownerType, ownerId: owner.ownerId } : 'skip'
  );
  const upsertCreditCard = useMutation(api.notifications.upsertCreditCard);
  const deleteCreditCard = useMutation(api.notifications.deleteCreditCard);

  const [notifDraft, setNotifDraft] = React.useState({
    budgetAlertsEnabled: true,
    budgetThresholdPct: 0.9,
    receiptAlertsEnabled: true,
    creditDueAlertsEnabled: true,
    creditDueDaysBefore: 3,
    weeklySummaryEnabled: true,
    monthlySummaryEnabled: true,
  });
  const [savingNotif, setSavingNotif] = React.useState(false);
  const [cardForm, setCardForm] = React.useState({
    id: '',
    name: '',
    dueDate: '',
    minimumPayment: '',
    statementBalance: '',
    lastStatementDate: '',
  });
  const [cardSaving, setCardSaving] = React.useState(false);

  const onSignOut = async () => {
    if (!isSignedIn) return;
    await signOut({ redirectUrl: '/' });
  };

  const onClear = async () => {
    if (!owner) return;
    await clearAll({ ownerType: owner.ownerType, ownerId: owner.ownerId });
    await bootstrapDefaults({ ownerType: owner.ownerType, ownerId: owner.ownerId });
  };

  React.useEffect(() => {
    if (!settingsData) return;
    setNotifDraft({
      budgetAlertsEnabled: settingsData.budgetAlertsEnabled,
      budgetThresholdPct: settingsData.budgetThresholdPct,
      receiptAlertsEnabled: settingsData.receiptAlertsEnabled,
      creditDueAlertsEnabled: settingsData.creditDueAlertsEnabled,
      creditDueDaysBefore: settingsData.creditDueDaysBefore,
      weeklySummaryEnabled: settingsData.weeklySummaryEnabled,
      monthlySummaryEnabled: settingsData.monthlySummaryEnabled,
    });
  }, [settingsData]);

  const onSaveNotifications = async () => {
    if (!owner || !isSignedIn) return;
    setSavingNotif(true);
    try {
      await notificationSettings({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        budgetAlertsEnabled: notifDraft.budgetAlertsEnabled,
        budgetThresholdPct: notifDraft.budgetThresholdPct,
        receiptAlertsEnabled: notifDraft.receiptAlertsEnabled,
        creditDueAlertsEnabled: notifDraft.creditDueAlertsEnabled,
        creditDueDaysBefore: notifDraft.creditDueDaysBefore,
        weeklySummaryEnabled: notifDraft.weeklySummaryEnabled,
        monthlySummaryEnabled: notifDraft.monthlySummaryEnabled,
      });
    } finally {
      setSavingNotif(false);
    }
  };

  const onSaveCard = async () => {
    if (!owner || !isSignedIn) return;
    if (!cardForm.name.trim() || !cardForm.dueDate.trim()) return;
    const minPayment = cardForm.minimumPayment.trim().length
      ? Number(cardForm.minimumPayment)
      : undefined;
    const statementBalance = cardForm.statementBalance.trim().length
      ? Number(cardForm.statementBalance)
      : undefined;
    setCardSaving(true);
    try {
      await upsertCreditCard({
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        cardId: cardForm.id ? (cardForm.id as any) : undefined,
        name: cardForm.name.trim(),
        dueDate: cardForm.dueDate.trim(),
        minimumPayment: Number.isFinite(minPayment) ? minPayment : undefined,
        statementBalance: Number.isFinite(statementBalance) ? statementBalance : undefined,
        lastStatementDate: cardForm.lastStatementDate.trim() || undefined,
      });
      setCardForm({
        id: '',
        name: '',
        dueDate: '',
        minimumPayment: '',
        statementBalance: '',
        lastStatementDate: '',
      });
    } finally {
      setCardSaving(false);
    }
  };

  const onEditCard = (card: any) => {
    setCardForm({
      id: card._id,
      name: card.name ?? '',
      dueDate: card.dueDate ?? '',
      minimumPayment: card.minimumPayment !== undefined && card.minimumPayment !== null ? String(card.minimumPayment) : '',
      statementBalance: card.statementBalance !== undefined && card.statementBalance !== null ? String(card.statementBalance) : '',
      lastStatementDate: card.lastStatementDate ?? '',
    });
  };

  const onDeleteCard = async (cardId: string) => {
    if (!owner || !isSignedIn) return;
    await deleteCreditCard({ ownerType: owner.ownerType, ownerId: owner.ownerId, cardId: cardId as any });
    if (cardForm.id === cardId) {
      setCardForm({
        id: '',
        name: '',
        dueDate: '',
        minimumPayment: '',
        statementBalance: '',
        lastStatementDate: '',
      });
    }
  };

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'settings')}</ThemedText>

      {/* User info */}
      <Card variant="elevated">
        {isSignedIn ? (
          <View style={{ gap: spacing.xs }}>
            <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
              {t(language, 'signedInAs')}
            </ThemedText>
            <ThemedText type="defaultSemiBold">{user?.emailAddresses?.[0]?.emailAddress}</ThemedText>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <ThemedText style={{ color: colors.textSecondary }}>{t(language, 'anonymousBanner')}</ThemedText>
            <Button variant="primary" size="sm" onPress={() => router.push('/sign-in')}>
              {t(language, 'signIn')}
            </Button>
          </View>
        )}
      </Card>

      {/* Style Picker */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            Style
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
            {themeIds.map((id) => (
              <ThemeSwatch
                key={id}
                themeId={id}
                isActive={id === brandTheme}
                onPress={() => setBrandTheme(id)}
              />
            ))}
          </ScrollView>
        </View>
      </Card>

      {/* Appearance */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'theme')}
          </ThemedText>
          <View style={[styles.pillRow, { gap: spacing.xs }]}>
            {(['system', 'light', 'dark'] as const).map((mode) => (
              <Pressable
                key={mode}
                onPress={() => setTheme(mode)}
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.borderLight },
                  theme === mode && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
              >
                <ThemedText style={[typography.caption, theme === mode && { fontWeight: '600', color: colors.primary }]}>
                  {t(language, mode)}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {/* Language */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'language')}
          </ThemedText>
          <View style={[styles.pillRow, { gap: spacing.xs }]}>
            {([['en', 'EN'], ['es', 'ES'], ['zh-cn', 'ZH']] as const).map(([code, label]) => (
              <Pressable
                key={code}
                onPress={() => setLanguage(code)}
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.borderLight },
                  language === code && { backgroundColor: colors.accentMuted, borderColor: colors.accent },
                ]}
              >
                <ThemedText style={[typography.caption, language === code && { fontWeight: '600', color: colors.accent }]}>
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {/* Notifications */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'notifications')}
          </ThemedText>
          {!isSignedIn ? (
            <ThemedText style={{ color: colors.textMuted }}>
              {t(language, 'upgradeToUnlock')} {t(language, 'notifications')}
            </ThemedText>
          ) : (
            <>
              <View style={styles.toggleRow}>
                <ThemedText>{t(language, 'budgetAlerts')}</ThemedText>
                <Switch
                  value={notifDraft.budgetAlertsEnabled}
                  onValueChange={(val) => setNotifDraft((prev) => ({ ...prev, budgetAlertsEnabled: val }))}
                />
              </View>
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={String(Math.round(notifDraft.budgetThresholdPct * 100))}
                onChangeText={(val) => {
                  const num = Number(val);
                  const pct = Number.isFinite(num) ? Math.min(Math.max(num, 50), 100) / 100 : notifDraft.budgetThresholdPct;
                  setNotifDraft((prev) => ({ ...prev, budgetThresholdPct: pct }));
                }}
                placeholder={t(language, 'budgetThreshold')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <View style={styles.toggleRow}>
                <ThemedText>{t(language, 'receiptAlerts')}</ThemedText>
                <Switch
                  value={notifDraft.receiptAlertsEnabled}
                  onValueChange={(val) => setNotifDraft((prev) => ({ ...prev, receiptAlertsEnabled: val }))}
                />
              </View>
              <View style={styles.toggleRow}>
                <ThemedText>{t(language, 'creditDueAlerts')}</ThemedText>
                <Switch
                  value={notifDraft.creditDueAlertsEnabled}
                  onValueChange={(val) => setNotifDraft((prev) => ({ ...prev, creditDueAlertsEnabled: val }))}
                />
              </View>
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={String(notifDraft.creditDueDaysBefore)}
                onChangeText={(val) => {
                  const num = Number(val);
                  if (!Number.isFinite(num)) return;
                  setNotifDraft((prev) => ({ ...prev, creditDueDaysBefore: Math.max(0, Math.min(30, num)) }));
                }}
                placeholder={t(language, 'creditDueDays')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <View style={styles.toggleRow}>
                <ThemedText>{t(language, 'weeklySummary')}</ThemedText>
                <Switch
                  value={notifDraft.weeklySummaryEnabled}
                  onValueChange={(val) => setNotifDraft((prev) => ({ ...prev, weeklySummaryEnabled: val }))}
                />
              </View>
              <View style={styles.toggleRow}>
                <ThemedText>{t(language, 'monthlySummary')}</ThemedText>
                <Switch
                  value={notifDraft.monthlySummaryEnabled}
                  onValueChange={(val) => setNotifDraft((prev) => ({ ...prev, monthlySummaryEnabled: val }))}
                />
              </View>
              <Button variant="outline" onPress={onSaveNotifications} disabled={savingNotif}>
                {t(language, 'saveNotifications')}
              </Button>
            </>
          )}
        </View>
      </Card>

      {/* Credit Cards */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'creditCards')}
          </ThemedText>
          {!isSignedIn ? (
            <ThemedText style={{ color: colors.textMuted }}>
              {t(language, 'upgradeToUnlock')} {t(language, 'creditCards')}
            </ThemedText>
          ) : (
            <>
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={cardForm.name}
                onChangeText={(val) => setCardForm((prev) => ({ ...prev, name: val }))}
                placeholder={t(language, 'cardName')}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={cardForm.dueDate}
                onChangeText={(val) => setCardForm((prev) => ({ ...prev, dueDate: val }))}
                placeholder={t(language, 'dueDate')}
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={cardForm.minimumPayment}
                onChangeText={(val) => setCardForm((prev) => ({ ...prev, minimumPayment: val }))}
                placeholder={t(language, 'minimumPayment')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={cardForm.statementBalance}
                onChangeText={(val) => setCardForm((prev) => ({ ...prev, statementBalance: val }))}
                placeholder={t(language, 'statementBalance')}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text }]}
                value={cardForm.lastStatementDate}
                onChangeText={(val) => setCardForm((prev) => ({ ...prev, lastStatementDate: val }))}
                placeholder={t(language, 'lastStatementDate')}
                placeholderTextColor={colors.textMuted}
              />
              <Button onPress={onSaveCard} disabled={cardSaving}>
                {cardForm.id ? t(language, 'save') : t(language, 'addCreditCard')}
              </Button>

              {creditCards && creditCards.length ? (
                <View style={{ gap: spacing.sm }}>
                  {creditCards.map((card) => (
                    <View key={card._id} style={[styles.row, { paddingVertical: spacing.xs }]}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold">{card.name}</ThemedText>
                        <ThemedText>{card.dueDate}</ThemedText>
                      </View>
                      <View style={[styles.row, { gap: spacing.xs }]}>
                        <Button variant="ghost" size="sm" onPress={() => onEditCard(card)}>
                          {t(language, 'edit')}
                        </Button>
                        <Button variant="ghost" size="sm" onPress={() => onDeleteCard(card._id)}>
                          {t(language, 'delete')}
                        </Button>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText>{t(language, 'noItems')}</ThemedText>
              )}
            </>
          )}
        </View>
      </Card>

      {/* Navigation Links */}
      <Card noPadding>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SettingsNavRow icon="card-outline" label={t(language, 'manageAccounts')} onPress={() => router.push('/(screens)/accounts')} />
          <View style={{ height: 1, backgroundColor: colors.borderLight }} />
          <SettingsNavRow icon="grid-outline" label={t(language, 'manageCategories')} onPress={() => router.push('/(screens)/categories')} />
          <View style={{ height: 1, backgroundColor: colors.borderLight }} />
          <SettingsNavRow icon="receipt-outline" label={t(language, 'receipts')} onPress={() => router.push('/(screens)/receipts')} />
          <View style={{ height: 1, backgroundColor: colors.borderLight }} />
          <SettingsNavRow icon="nutrition-outline" label={t(language, 'pantry')} onPress={() => router.push('/(screens)/pantry')} />
        </View>
      </Card>

      {/* Sync Settings */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          <ThemedText style={[typography.label, { color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {t(language, 'backgroundSync')}
          </ThemedText>
          <View style={[styles.pillRow, { gap: spacing.xs }]}>
            {[t(language, 'manualOnly'), t(language, 'daily'), t(language, 'twiceDaily')].map((label, idx) => (
              <Pressable
                key={label}
                disabled
                style={[
                  styles.pill,
                  { borderRadius: borderRadius.pill, borderColor: colors.borderLight, opacity: 0.5 },
                  idx === 0 && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
              >
                <ThemedText style={[typography.caption, idx === 0 && { fontWeight: '600', color: colors.primary }]}>
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Card>

      {/* Actions */}
      <Card>
        <View style={{ gap: spacing.sm }}>
          {isSignedIn ? (
            <Button variant="outline" onPress={onSignOut}>{t(language, 'signOut')}</Button>
          ) : (
            <Button variant="primary" onPress={() => router.push('/sign-in')}>{t(language, 'signIn')}</Button>
          )}
          <Button variant="outline" onPress={onClear}>{t(language, 'clearData')}</Button>
          {!entitlements.canUsePlaid && (
            <ThemedText style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              {t(language, 'upgradeToUnlock')}
            </ThemedText>
          )}
        </View>
      </Card>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  input: {
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
