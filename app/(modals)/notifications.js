import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useTranslation } from "@injured/i18n";
export default function NotificationsScreen() {
    const { t } = useTranslation();
    return (_jsxs(ThemedView, { style: { flex: 1, padding: 16 }, children: [_jsx(ThemedText, { variant: "heading", children: t("notifications") }), _jsx(ThemedText, { children: t("notificationsDescription") })] }));
}
