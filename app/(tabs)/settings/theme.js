import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StyleSheet, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@injured/i18n";
import { router } from "expo-router";
import { ThemedCheckbox, ThemedToggle } from "@injured/ui";
export default function ThemeSettings() {
    const { t } = useTranslation();
    const { theme, setTheme, contrast, setContrast, reducedMotion, setReducedMotion, } = useSettings();
    const isSystem = theme === "system";
    const isDark = theme === "dark";
    return (_jsxs(Screen, { children: [_jsx(ThemedText, { variant: "heading", style: styles.screenTitle, children: t("theme") }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("selectTheme") }), _jsxs(View, { style: styles.column, children: [_jsx(ThemedCheckbox, { checked: isSystem, onChange: (checked) => {
                                    if (checked)
                                        setTheme("system");
                                    else
                                        setTheme("light"); // fallback if unchecked
                                }, label: t("system") }), _jsxs(View, { style: styles.row, children: [_jsx(ThemedText, { children: t("light") }), _jsx(ThemedToggle, { checked: isDark, onValueChange: (next) => setTheme(next ? "dark" : "light") }), _jsx(ThemedText, { children: t("dark") })] })] })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("contrast") }), _jsx(ThemedText, { style: styles.description, children: t("contrastDescription", {
                            defaultValue: "High contrast increases color contrast for improved readability and accessibility.",
                        }) }), _jsx(View, { style: styles.row, children: _jsx(ThemedCheckbox, { checked: contrast === "high", onChange: (checked) => setContrast(checked ? "high" : "default"), label: t("highContrast") }) })] }), _jsxs(ThemedView, { style: styles.section, children: [_jsx(ThemedText, { variant: "subheading", children: t("reducedMotion") }), _jsx(ThemedText, { style: styles.description, children: t("reducedMotionDescription", {
                            defaultValue: "Disable animations and motion effects to reduce visual movement.",
                        }) }), _jsx(View, { style: styles.row, children: _jsx(ThemedCheckbox, { checked: !!reducedMotion, onChange: (v) => setReducedMotion(!!v), label: t("enableReducedMotion", {
                                defaultValue: "Enable reduced motion",
                            }) }) })] }), _jsx(ThemedView, { style: styles.section, children: _jsx(ThemedButton, { onPress: () => router.back(), children: t("back") }) })] }));
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
    column: {
        flexDirection: "column",
        gap: 12,
    },
    description: {
        opacity: 0.8,
    },
});
