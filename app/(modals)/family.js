import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
    const orgs = useQuery(api.auth.organizations.listUserOrganizations, userDoc?._id ? { userId: userDoc._id } : "skip");
    // Pick first org of type FAMILY; if none, allow creating one
    const familyOrg = (orgs || []).find((o) => o?.type === "FAMILY") || null;
    const [orgName, setOrgName] = React.useState("");
    const [inviteEmail, setInviteEmail] = React.useState("");
    const createOrg = useMutation(api.auth.organizations.createOrganization);
    const updateOrg = useMutation(api.auth.organizations.updateOrganization);
    const addMember = useMutation(api.auth.organizations.addMember);
    const removeMember = useMutation(api.auth.organizations.removeMember);
    const listMembers = useQuery(api.auth.organizations.listMembersByOrg, familyOrg?._id
        ? { organizationId: familyOrg._id }
        : "skip");
    React.useEffect(() => {
        const n = familyOrg?.name;
        if (n)
            setOrgName(n);
    }, [familyOrg?.name]);
    if (!userDoc)
        return null;
    return (_jsx(ParallaxScrollView, { headerBackgroundColor: { light: "#D0D0D0", dark: "#353636" }, headerImage: _jsx(Ionicons, { size: 310, name: "people", style: styles.headerImage }), children: _jsxs(ThemedView, { style: styles.container, children: [_jsx(ThemedText, { variant: "heading", children: t("family") }), !familyOrg ? (_jsxs(View, { style: styles.row, children: [_jsx(TextInput, { style: styles.input, placeholder: t("familyNamePlaceholder"), value: orgName, onChangeText: setOrgName }), _jsx(ThemedButton, { onPress: async () => {
                                if (!userDoc?._id)
                                    return;
                                if (!orgName.trim())
                                    return;
                                await createOrg({
                                    actorUserId: userDoc._id,
                                    name: orgName.trim(),
                                    slug: orgName.trim().toLowerCase().replace(/\s+/g, "-"),
                                    type: "FAMILY",
                                });
                            }, children: t("create") })] })) : (_jsxs(_Fragment, { children: [_jsx(ThemedText, { variant: "subheading", children: t("familyName") }), _jsxs(View, { style: styles.row, children: [_jsx(TextInput, { style: styles.input, value: orgName, onChangeText: setOrgName }), _jsx(ThemedButton, { onPress: async () => {
                                        if (!userDoc?._id || !familyOrg?._id)
                                            return;
                                        await updateOrg({
                                            actorUserId: userDoc._id,
                                            organizationId: familyOrg._id,
                                            name: orgName,
                                        });
                                    }, children: t("save") })] })] })), familyOrg && (_jsxs(_Fragment, { children: [_jsx(ThemedText, { variant: "subheading", children: t("members") }), _jsx(View, { style: { gap: 8 }, children: (listMembers ?? []).map((m) => (_jsxs(View, { style: styles.memberRow, children: [_jsxs(ThemedText, { children: [m.user?.email || m.user?.name || m.clerkUserId, " (", m.role, ")"] }), m.userId !== userDoc?._id && (_jsx(ThemedButton, { onPress: async () => {
                                            await removeMember({
                                                actorUserId: userDoc._id,
                                                organizationId: familyOrg._id,
                                                userId: m.userId,
                                            });
                                        }, children: t("remove") }))] }, m._id))) })] })), familyOrg && (_jsxs(View, { style: styles.row, children: [_jsx(TextInput, { placeholder: t("addMemberPlaceholder"), style: styles.input, value: inviteEmail, onChangeText: setInviteEmail, autoCapitalize: "none", keyboardType: "email-address" }), _jsx(ThemedButton, { onPress: async () => {
                                if (!inviteEmail.trim() || !userDoc?._id)
                                    return;
                                const found = await convex.query(api.auth.users.getUserByEmail, { email: inviteEmail.trim() });
                                if (!found?._id)
                                    return;
                                await addMember({
                                    actorUserId: userDoc._id,
                                    organizationId: familyOrg._id,
                                    userId: found._id,
                                    role: "MEMBER",
                                });
                                setInviteEmail("");
                            }, children: t("add") })] }))] }) }));
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
