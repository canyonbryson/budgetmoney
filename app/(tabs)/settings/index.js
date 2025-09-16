import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StyleSheet } from "react-native";
import Screen from "@/components/ui/Screen";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useUser } from "@clerk/clerk-expo";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@injured/i18n";
import { router } from "expo-router";
export default function Settings() {
    const { t } = useTranslation();
    const { user } = useUser();
    const { language } = useSettings();
    return (_jsxs(Screen, { children: [_jsx(ThemedText, { variant: "heading", style: styles.screenTitle, children: t("settings") }), _jsx(ThemedView, { style: styles.titleContainer, children: _jsxs(ThemedText, { variant: "subheading", children: [t("signedInAs"), " ", user?.emailAddresses?.[0]?.emailAddress] }) }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("theme") }), _jsx(ThemedButton, { onPress: () => router.push("/(tabs)/settings/theme"), children: t("themeSettings") })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("language") }), _jsx(ThemedButton, { onPress: () => router.push("/(tabs)/settings/language"), children: t("languageSettings") })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("family") }), _jsx(ThemedButton, { onPress: () => router.push("/(modals)/family"), children: t("manageFamily") })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("profile") }), _jsx(ThemedButton, { onPress: () => router.push("/(modals)/profile"), children: t("editProfile") })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("notifications") }), _jsx(ThemedButton, { onPress: () => router.push("/(modals)/notifications"), children: t("notificationSettings") })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("uiShowcase") }), _jsx(ThemedButton, { onPress: () => router.push("/(tabs)/settings/ui-primitives"), children: t("viewUIPrimitives") }), _jsx(ThemedButton, { onPress: () => router.push("/(tabs)/settings/ui-components"), children: "Components Showcase" })] })] }));
}
const styles = StyleSheet.create({
    screenTitle: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 20,
    },
    headerImage: {
        color: "#808080",
        bottom: -90,
        left: -35,
        position: "absolute",
    },
    titleContainer: {
        flexDirection: "column",
        gap: 8,
        marginBottom: 24,
    },
    section: {
        gap: 12,
        marginBottom: 24,
    },
    row: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
    },
});
