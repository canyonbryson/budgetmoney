import React from 'react';
import { Share, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { api } from '@/convex/_generated/api';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function FamilyInviteScreen() {
  const { isSignedIn } = useAuth();
  const { spacing, borderRadius, colors } = useAppTheme();
  const createInvite = useMutation(api.families.createInvite);
  const [email, setEmail] = React.useState('');
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onCreateInvite = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await createInvite({ invitedEmail: email.trim() || undefined });
      setInviteUrl(result.inviteUrl);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create invite.');
    } finally {
      setLoading(false);
    }
  };

  if (!isSignedIn) {
    return (
      <ScreenScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <View style={{ gap: spacing.md }}>
            <ThemedText>Sign in to create an invite.</ThemedText>
            <Button onPress={() => router.push('/sign-in')}>Sign in</Button>
          </View>
        </Card>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <ThemedText type="title">Invite Family Member</ThemedText>
      <Card>
        <View style={{ gap: spacing.md }}>
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: borderRadius.sm,
              height: 44,
              paddingHorizontal: 12,
              color: colors.text,
            }}
            placeholder="Email (optional)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Button onPress={onCreateInvite} disabled={loading}>
            {loading ? 'Creating invite...' : 'Create invite link'}
          </Button>
          {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
        </View>
      </Card>

      {inviteUrl ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <ThemedText>{inviteUrl}</ThemedText>
            <Button
              onPress={async () => {
                await Share.share({ message: inviteUrl });
              }}
            >
              Share link
            </Button>
          </View>
        </Card>
      ) : null}
    </ScreenScrollView>
  );
}
