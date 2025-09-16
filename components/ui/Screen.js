import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ThemedScreen } from "@injured/ui";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
export default function Screen({ title, showTitle = false, right, left, children, ...rest }) {
    const header = showTitle && title ? (_jsxs(ThemedView, { style: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12 }, children: [left, _jsx(ThemedText, { variant: "heading", style: { textAlign: "center", flex: 1 }, children: title }), right] })) : undefined;
    return (_jsx(ThemedScreen, { header: header, ...rest, children: children }));
}
