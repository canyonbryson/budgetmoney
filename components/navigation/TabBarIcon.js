import { jsx as _jsx } from "react/jsx-runtime";
import { Ionicons } from "@expo/vector-icons";
export function TabBarIcon({ style, ...rest }) {
    return (_jsx(Ionicons, { size: rest.size ?? 24, style: [{ marginBottom: 0 }, style], ...rest }));
}
