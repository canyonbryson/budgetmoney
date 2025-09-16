import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StyleSheet, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@injured/i18n";
import { router } from "expo-router";
export default function LanguageSettings() {
    const { t } = useTranslation();
    const { language, setLanguage } = useSettings();
    return (_jsxs(Screen, { children: [_jsx(ThemedText, { variant: "heading", style: styles.screenTitle, children: t("language") }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("selectLanguage") }), _jsxs(View, { style: styles.row, children: [_jsx(ThemedButton, { onPress: () => setLanguage("en"), disabled: language === "en", children: "EN" }), _jsx(ThemedButton, { onPress: () => setLanguage("es"), disabled: language === "es", children: "ES" }), _jsx(ThemedButton, { onPress: () => setLanguage("zh-CN"), disabled: language === "zh-CN", children: "ZH" })] })] }), _jsx(ThemedView, { style: styles.section, children: _jsx(ThemedButton, { onPress: () => router.back(), children: t("back") }) })] }));
}
const styles = StyleSheet.create({
    screenTitle: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 20,
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
