import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocalSearchParams } from "expo-router";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import Screen from "@/components/ui/Screen";
import { useTranslation } from "@injured/i18n";
export default function InjuryDetailScreen() {
    const { injuryId } = useLocalSearchParams();
    const { t } = useTranslation();
    return (_jsx(Screen, { children: _jsxs(ThemedView, { style: { flex: 1, padding: 16 }, children: [_jsx(ThemedText, { variant: "heading", children: t("injuryDetails") }), _jsxs(ThemedText, { children: [t("injuryId"), ": ", injuryId] })] }) }));
}
