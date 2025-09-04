import React from '../../$node_modules/@types/react/index.js';
import { StyleSheet, TextInput, View } from '../../$node_modules/react-native/types/index.js';
import ParallaxScrollView from '@/components/ui/ParallaxScrollView.js';
import { ThemedText } from '@/components/ui/ThemedText.js';
import { ThemedView } from '@/components/ui/ThemedView.js';
import Button from '@/components/ui/Button.js';
import { useConvex, useMutation, useQuery } from '../../$node_modules/convex/dist/esm-types/react/index.js';
import { api } from '@/convex/_generated/api';
// Clerk hooks are avoided here to keep types simple; we resolve current user via Convex
import Ionicons from '../../$node_modules/@expo/vector-icons/Ionicons.js';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';

export default function FamilyScreen() {
  const { language } = useSettings();
  const convex = useConvex();
  const userDoc = useQuery(api.auth.users.getCurrentUser, {});
  const orgs = useQuery(
    api.auth.organizations.listUserOrganizations,
    userDoc?._id ? { userId: userDoc._id } : 'skip',
  );
  // Pick first org of type FAMILY; if none, allow creating one
  const familyOrg = (orgs || []).find((o: any) => o?.type === 'FAMILY') || null;
  const [orgName, setOrgName] = React.useState('');
  const [inviteEmail, setInviteEmail] = React.useState('');

  const createOrg = useMutation(api.auth.organizations.createOrganization);
  const updateOrg = useMutation(api.auth.organizations.updateOrganization);
  const addMember = useMutation(api.auth.organizations.addMember);
  const removeMember = useMutation(api.auth.organizations.removeMember);
  const listMembers = useQuery(
    api.auth.organizations.listMembersByOrg,
    (familyOrg as any)?._id ? { organizationId: (familyOrg as any)._id as any } : 'skip',
  );

  React.useEffect(() => {
    const n = (familyOrg as any)?.name as string | undefined;
    if (n) setOrgName(n);
  }, [(familyOrg as any)?.name]);

  if (!userDoc) return null;

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={<Ionicons size={310} name="people" style={styles.headerImage} />}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">Family</ThemedText>
        {!familyOrg ? (
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Family name"
              value={orgName}
              onChangeText={setOrgName}
            />
            <Button
              onPress={async () => {
                if (!userDoc?._id) return;
                if (!orgName.trim()) return;
                await createOrg({
                  actorUserId: userDoc._id,
                  name: orgName.trim(),
                  slug: orgName.trim().toLowerCase().replace(/\s+/g, '-'),
                  type: 'FAMILY',
                });
              }}
            >Create</Button>
          </View>
        ) : (
          <>
            <ThemedText type="subtitle">Family name</ThemedText>
            <View style={styles.row}>
              <TextInput style={styles.input} value={orgName} onChangeText={setOrgName} />
              <Button
                onPress={async () => {
                  if (!userDoc?._id || !(familyOrg as any)?._id) return;
                  await updateOrg({
                    actorUserId: userDoc._id,
                    organizationId: (familyOrg as any)._id as any,
                    name: orgName,
                  });
                }}
              >Save</Button>
            </View>
          </>
        )}

        {familyOrg && (
          <>
            <ThemedText type="subtitle">Members</ThemedText>
            <View style={{ gap: 8 }}>
              {(listMembers ?? []).map((m: any) => (
                <View key={m._id} style={styles.memberRow}>
                  <ThemedText>{m.user?.email || m.user?.name || m.clerkUserId} ({m.role})</ThemedText>
                  {m.userId !== userDoc?._id && (
                    <Button
                      onPress={async () => {
                        await removeMember({
                          actorUserId: userDoc!._id,
                          organizationId: (familyOrg as any)._id as any,
                          userId: m.userId,
                        });
                      }}
                    >Remove</Button>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {familyOrg && (
          <View style={styles.row}>
            <TextInput
              placeholder="Add member by user email (existing user)"
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Button
              onPress={async () => {
                if (!inviteEmail.trim() || !userDoc?._id) return;
                const found = await convex.query(api.auth.users.getUserByEmail, { email: inviteEmail.trim() });
                if (!found?._id) return;
                await addMember({
                  actorUserId: userDoc._id,
                  organizationId: (familyOrg as any)._id as any,
                  userId: found._id,
                  role: 'MEMBER',
                });
                setInviteEmail('');
              }}
            >Add</Button>
          </View>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  container: {
    gap: 12,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    borderColor: 'rgba(0,0,0,0.11)'
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
});


