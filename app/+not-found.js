import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, Stack } from "expo-router";
import { useTranslation } from "@injured/i18n";
import { StyleSheet } from "react-native";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
export default function NotFoundScreen() {
    const { t } = useTranslation();
    return (_jsxs(_Fragment, { children: [_jsx(Stack.Screen, { options: { title: t("oops") } }), _jsxs(ThemedView, { style: styles.container, children: [_jsx(ThemedText, { variant: "heading", children: t("screenDoesNotExist") }), _jsx(Link, { href: "/", style: styles.link, children: _jsx(ThemedText, { variant: "link", children: t("goHome") }) })] })] }));
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
    },
});
