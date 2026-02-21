import React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { api } from '@/convex/_generated/api';
import { useAppTheme } from '@/hooks/useAppTheme';

export default function FamilyScreen() {
  const { isSignedIn } = useAuth();
  const { spacing, typography, colors } = useAppTheme();
  const createFamily = useMutation(api.families.createFamily);
  const myFamily = useQuery(api.families.getMyFamily, isSignedIn ? {} : 'skip');
  const members = useQuery(api.families.listMembers, isSignedIn ? {} : 'skip');
  const [creating, setCreating] = React.useState(false);

  const onCreateFamily = async () => {
    setCreating(true);
    try {
      await createFamily({});
    } finally {
      setCreating(false);
    }
  };

  if (!isSignedIn) {
    return (
      <ScreenScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <ThemedText type="title">Family</ThemedText>
        <Card>
          <View style={{ gap: spacing.md }}>
            <ThemedText style={typography.body}>
              Sign in to create or join a family and share all budgets, accounts, and meal planning data.
            </ThemedText>
            <Button onPress={() => router.push('/sign-in')}>Sign in</Button>
          </View>
        </Card>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <ThemedText type="title">Family</ThemedText>
      {!myFamily ? (
        <Card>
          <View style={{ gap: spacing.md }}>
            <ThemedText style={typography.body}>
              Create a family to share budgets, accounts, transactions, meal plans, recipes, and receipts.
            </ThemedText>
            <Button onPress={onCreateFamily} disabled={creating}>
              {creating ? 'Creating...' : 'Create family'}
            </Button>
          </View>
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ gap: spacing.sm }}>
              <ThemedText type="subtitle">{myFamily.familyName}</ThemedText>
              <ThemedText style={{ color: colors.textMuted }}>
                Role: {myFamily.role}
              </ThemedText>
              <ThemedText style={{ color: colors.textMuted }}>
                Pending invites: {myFamily.pendingInviteCount}
              </ThemedText>
              <Button onPress={() => router.push('/(screens)/family-invite')}>Invite someone</Button>
            </View>
          </Card>

          <Card>
            <View style={{ gap: spacing.sm }}>
              <ThemedText style={[typography.label, { color: colors.textMuted }]}>Members</ThemedText>
              {(members ?? []).map((member) => (
                <View
                  key={member.id}
                  style={{
                    paddingVertical: spacing.xs,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.borderLight,
                    gap: 2,
                  }}
                >
                  <ThemedText>{member.email ?? member.userId}</ThemedText>
                  <ThemedText style={{ color: colors.textMuted }}>{member.role}</ThemedText>
                </View>
              ))}
              {members && members.length === 0 ? (
                <ThemedText style={{ color: colors.textMuted }}>No members yet.</ThemedText>
              ) : null}
            </View>
          </Card>

          <Pressable onPress={() => router.push('/(tabs)/settings')}>
            <ThemedText style={{ color: colors.accent }}>Back to Settings</ThemedText>
          </Pressable>
        </>
      )}
    </ScreenScrollView>
  );
}
