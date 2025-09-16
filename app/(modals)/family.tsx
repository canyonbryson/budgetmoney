import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import ParallaxScrollView from "@/components/ui/ParallaxScrollView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
// Clerk hooks are avoided here to keep types simple; we resolve current user via Convex
import { Ionicons } from "@expo/vector-icons";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@injured/i18n";

export default function FamilyScreen() {
  const { t } = useTranslation();
  const { language } = useSettings();
  const convex = useConvex();
  const userDoc = useQuery(api.auth.users.getCurrentUser, {});
  const orgs = useQuery(
    api.auth.organizations.listUserOrganizations,
    userDoc?._id ? { userId: userDoc._id } : "skip",
  );
  // Pick first org of type FAMILY; if none, allow creating one
  const familyOrg = (orgs || []).find((o: any) => o?.type === "FAMILY") || null;
  const [orgName, setOrgName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");

  const createOrg = useMutation(api.auth.organizations.createOrganization);
  const updateOrg = useMutation(api.auth.organizations.updateOrganization);
  const addMember = useMutation(api.auth.organizations.addMember);
  const removeMember = useMutation(api.auth.organizations.removeMember);
  const listMembers = useQuery(
    api.auth.organizations.listMembersByOrg,
    (familyOrg as any)?._id
      ? { organizationId: (familyOrg as any)._id as any }
      : "skip",
  );

  React.useEffect(() => {
    const n = (familyOrg as any)?.name as string | undefined;
    if (n) setOrgName(n);
  }, [(familyOrg as any)?.name]);

  if (!userDoc) return null;

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={
        <Ionicons size={310} name="people" style={styles.headerImage} />
      }
    >
      <ThemedView style={styles.container}>
        <ThemedText variant="heading">{t("family")}</ThemedText>
        {!familyOrg ? (
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder={t("familyNamePlaceholder")}
              value={orgName}
              onChangeText={setOrgName}
            />
            <ThemedButton
              onPress={async () => {
                if (!userDoc?._id) return;
                if (!orgName.trim()) return;
                await createOrg({
                  actorUserId: userDoc._id,
                  name: orgName.trim(),
                  slug: orgName.trim().toLowerCase().replace(/\s+/g, "-"),
                  type: "FAMILY",
                });
              }}
            >
              {t("create")}
            </ThemedButton>
          </View>
        ) : (
          <>
            <ThemedText variant="subheading">{t("familyName")}</ThemedText>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                value={orgName}
                onChangeText={setOrgName}
              />
              <ThemedButton
                onPress={async () => {
                  if (!userDoc?._id || !(familyOrg as any)?._id) return;
                  await updateOrg({
                    actorUserId: userDoc._id,
                    organizationId: (familyOrg as any)._id as any,
                    name: orgName,
                  });
                }}
              >
                {t("save")}
              </ThemedButton>
            </View>
          </>
        )}

        {familyOrg && (
          <>
            <ThemedText variant="subheading">{t("members")}</ThemedText>
            <View style={{ gap: 8 }}>
              {(listMembers ?? []).map((m: any) => (
                <View key={m._id} style={styles.memberRow}>
                  <ThemedText>
                    {m.user?.email || m.user?.name || m.clerkUserId} ({m.role})
                  </ThemedText>
                  {m.userId !== userDoc?._id && (
                    <ThemedButton
                      onPress={async () => {
                        await removeMember({
                          actorUserId: userDoc!._id,
                          organizationId: (familyOrg as any)._id as any,
                          userId: m.userId,
                        });
                      }}
                    >
                      {t("remove")}
                    </ThemedButton>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {familyOrg && (
          <View style={styles.row}>
            <TextInput
              placeholder={t("addMemberPlaceholder")}
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <ThemedButton
              onPress={async () => {
                if (!inviteEmail.trim() || !userDoc?._id) return;
                const found = await convex.query(
                  api.auth.users.getUserByEmail,
                  { email: inviteEmail.trim() },
                );
                if (!found?._id) return;
                await addMember({
                  actorUserId: userDoc._id,
                  organizationId: (familyOrg as any)._id as any,
                  userId: found._id,
                  role: "MEMBER",
                });
                setInviteEmail("");
              }}
            >
              {t("add")}
            </ThemedButton>
          </View>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  container: {
    gap: 12,
    padding: 12,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    borderColor: "rgba(0,0,0,0.11)",
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
