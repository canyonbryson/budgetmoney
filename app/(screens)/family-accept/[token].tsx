import React from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { api } from '@/convex/_generated/api';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function FamilyAcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { isSignedIn } = useAuth();
  const { spacing, colors } = useAppTheme();
  const acceptInvite = useMutation(api.families.acceptInviteByToken);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [accepted, setAccepted] = React.useState(false);

  const onAccept = async () => {
    if (!token || Array.isArray(token)) return;
    setLoading(true);
    setError(null);
    try {
      await acceptInvite({ token });
      setAccepted(true);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to accept invite.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || Array.isArray(token)) {
    return (
      <ScreenScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <ThemedText>Invalid invite link.</ThemedText>
        </Card>
      </ScreenScrollView>
    );
  }

  if (!isSignedIn) {
    const returnTo = encodeURIComponent(`/(screens)/family-accept/${token}`);
    return (
      <ScreenScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Card>
          <View style={{ gap: spacing.md }}>
            <ThemedText type="subtitle">Sign in required</ThemedText>
            <ThemedText>Sign in to accept this family invite.</ThemedText>
            <Button onPress={() => router.push(`/sign-in?returnTo=${returnTo}`)}>
              Sign in
            </Button>
          </View>
        </Card>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: spacing.lg }}>
      <Card>
        <View style={{ gap: spacing.md }}>
          <ThemedText type="subtitle">Join this family?</ThemedText>
          <ThemedText>
            Accepting this invite moves your current data into the family workspace.
          </ThemedText>
          {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
          {accepted ? (
            <>
              <ThemedText>Invite accepted. Your data is now shared with this family.</ThemedText>
              <Button onPress={() => router.replace('/(screens)/family')}>Open family</Button>
            </>
          ) : (
            <Button onPress={onAccept} disabled={loading}>
              {loading ? 'Accepting...' : 'Accept invite'}
            </Button>
          )}
        </View>
      </Card>
    </ScreenScrollView>
  );
}
