// app/(tabs)/FamilyScreen.tsx
import { Ionicons } from "@expo/vector-icons";
import { api } from "@injured/backend/convex/_generated/api";
import { useTranslation } from "@injured/i18n";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useAction, useConvex, useMutation, useQuery } from "convex/react";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import ParallaxScrollView from "@/components/ui/ParallaxScrollView";
import { useSettings } from "@/contexts/SettingsContext";

type MemberRole = "ADMIN" | "MEMBER";

export default function FamilyScreen() {
  const { t } = useTranslation();
  const { language } = useSettings();
  const convex = useConvex();

  const userDoc = useQuery(api.auth.users.getCurrentUser, {});
  const orgs = useQuery(
    api.auth.organizations.listUserOrganizations,
    userDoc?._id ? { userId: userDoc._id } : "skip",
  );

  const familyOrg = (orgs || []).find((o: any) => o?.type === "FAMILY") || null;

  const [orgName, setOrgName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);

  const createOrg = useAction(api.auth.organizations.createOrganizationClerkFirst);
  const updateOrg = useAction(api.auth.organizations.updateOrganizationClerkFirst);
  const addMember = useMutation(api.auth.organizations.addMember);
  const removeMember = useMutation(api.auth.organizations.removeMember);
  const setMemberRole = useMutation(api.auth.organizations.setMemberRole);

  const listMembers = useQuery(
    api.auth.organizations.listMembersByOrg,
    (familyOrg as any)?._id ? { organizationId: (familyOrg as any)._id } : "skip",
  );

  React.useEffect(() => {
    const n = (familyOrg as any)?.name as string | undefined;
    if (n) setOrgName(n);
  }, [familyOrg]);

  if (userDoc === undefined) {
    return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
        headerImage={<Ionicons size={310} name="people" style={styles.headerImage} />}
      >
        <ThemedView style={styles.container}>
          <ThemedText>Loading…</ThemedText>
        </ThemedView>
      </ParallaxScrollView>
    );
  }
  if (!userDoc) {
    return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
        headerImage={<Ionicons size={310} name="people" style={styles.headerImage} />}
      >
        <ThemedView style={styles.container}>
          <ThemedText>Sign in to manage your family.</ThemedText>
        </ThemedView>
      </ParallaxScrollView>
    );
  }

  // Determine current user's role in the family org (for UI gating)
  const myRole: MemberRole | null =
    (listMembers || [])
      .find((m: any) => m.userId === userDoc._id)?.role ?? null;
  const canManage = myRole === "ADMIN";

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={<Ionicons size={310} name="people" style={styles.headerImage} />}
    >
      <ThemedView style={styles.container}>
        <ThemedText variant="heading">{t("family")}</ThemedText>

        {!familyOrg ? (
          <>
            <ThemedText style={{ opacity: 0.8 }}>
              {t("createAFamilyDescription") ?? "Create a private family to share recovery, notes, and permissions."}
            </ThemedText>
            <View style={styles.row}>
              <TextInput
                style={styles.input}
                placeholder={t("familyNamePlaceholder") ?? "Family name"}
                value={orgName}
                onChangeText={setOrgName}
              />
              <ThemedButton
                disabled={!orgName.trim() || !!busy}
                onPress={async () => {
                  if (!userDoc?._id || !orgName.trim()) return;
                  setBusy("create");
                  try {
                    await createOrg({
                      actorUserId: userDoc._id,
                      name: orgName.trim(),
                      slug: orgName.trim().toLowerCase().replace(/\s+/g, "-"),
                      type: "FAMILY",
                    });
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === "create" ? t("creating") ?? "Creating…" : t("create") ?? "Create"}
              </ThemedButton>
            </View>
          </>
        ) : (
          <>
            <ThemedText variant="subheading">{t("familyName") ?? "Family name"}</ThemedText>
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { opacity: canManage ? 1 : 0.6 }]}
                value={orgName}
                onChangeText={setOrgName}
                editable={canManage}
              />
              {canManage && (
                <ThemedButton
                  disabled={!!busy}
                  onPress={async () => {
                    if (!userDoc?._id || !(familyOrg as any)?._id) return;
                    setBusy("saveName");
                    try {
                      await updateOrg({
                        actorUserId: userDoc._id,
                        organizationId: (familyOrg as any)._id,
                        name: orgName.trim(),
                      });
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "saveName" ? t("saving") ?? "Saving…" : t("save") ?? "Save"}
                </ThemedButton>
              )}
            </View>

            <ThemedText variant="subheading" style={{ marginTop: 12 }}>
              {t("members") ?? "Members"}
            </ThemedText>
            <View style={{ gap: 8 }}>
              {(listMembers ?? []).map((m: any) => {
                const isSelf = m.userId === userDoc._id;
                const role: MemberRole = m.role;
                return (
                  <View key={m._id} style={styles.memberRow}>
                    <View style={{ flex: 1 }}>
                      <ThemedText>
                        {m.user?.name || m.user?.email || m.user?.externalId || "User"}
                      </ThemedText>
                      <ThemedText style={styles.badge}>
                        {role}
                      </ThemedText>
                    </View>

                    {/* Actions (only admins, and not against themselves) */}
                    {canManage && !isSelf && (
                      <View style={{ flexDirection: "row", gap: 6 }}>
                        {/* Promote / Demote */}
                        {role !== "ADMIN" && (
                          <ThemedButton
                            size="sm"
                            onPress={async () => {
                              setBusy(`promote-${m._id}`);
                              try {
                                await setMemberRole({
                                  actorUserId: userDoc._id,
                                  organizationId: (familyOrg as any)._id,
                                  userId: m.userId,
                                  role: "ADMIN", 
                                });
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            {busy === `promote-${m._id}` ? (t("working") ?? "Working…") : (t("makeAdmin") ?? "Make admin")}
                          </ThemedButton>
                        )}
                        {role !== "MEMBER" && (
                          <ThemedButton
                            size="sm"
                            variant="secondary"
                            onPress={async () => {
                              setBusy(`demote-${m._id}`);
                              try {
                                await setMemberRole({
                                  actorUserId: userDoc._id,
                                  organizationId: (familyOrg as any)._id,
                                  userId: m.userId,
                                  role: "MEMBER",
                                });
                              } finally {
                                setBusy(null);
                              }
                            }}
                          >
                            {busy === `demote-${m._id}` ? (t("working") ?? "Working…") : (t("makeMember") ?? "Make member")}
                          </ThemedButton>
                        )}
                        <ThemedButton
                          size="sm"
                          onPress={async () => {
                            setBusy(`remove-${m._id}`);
                            try {
                              await removeMember({
                                actorUserId: userDoc!._id,
                                organizationId: (familyOrg as any)._id,
                                userId: m.userId,
                              });
                            } finally {
                              setBusy(null);
                            }
                          }}
                        >
                          {busy === `remove-${m._id}` ? (t("removing") ?? "Removing…") : (t("remove") ?? "Remove")}
                        </ThemedButton>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Invite by email */}
            {canManage && (
              <View style={[styles.row, { marginTop: 12 }]}>
                <TextInput
                  placeholder={t("addMemberPlaceholder") ?? "Add member by email"}
                  style={styles.input}
                  value={inviteEmail}
                  onChangeText={setInviteEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <ThemedButton
                  disabled={!inviteEmail.trim() || !!busy}
                  onPress={async () => {
                    if (!inviteEmail.trim() || !userDoc?._id) return;
                    setBusy("invite");
                    try {
                      const found = await convex.query(api.auth.users.getUserByEmail, {
                        email: inviteEmail.trim(),
                      });
                      if (!found?._id) {
                        // Optionally: show toast "User not found"
                        return;
                      }
                      await addMember({
                        actorUserId: userDoc._id,
                        organizationId: (familyOrg as any)._id,
                        userId: found._id,
                        role: "MEMBER",
                      });
                      setInviteEmail("");
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === "invite" ? (t("adding") ?? "Adding…") : (t("add") ?? "Add")}
                </ThemedButton>
              </View>
            )}
          </>
        )}
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: { color: "#808080", bottom: -90, left: -35, position: "absolute" },
  container: { gap: 12, padding: 12 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1, height: 40, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10,
    borderColor: "rgba(0,0,0,0.11)",
  },
  memberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    opacity: 0.8,
  },
});
