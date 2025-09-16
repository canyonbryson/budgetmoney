import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import Screen from "@/components/ui/Screen";
export default function ForgotPasswordScreen() {
    return (_jsx(Screen, { children: _jsxs(ThemedView, { style: { flex: 1, padding: 16 }, children: [_jsx(ThemedText, { variant: "heading", children: "Forgot Password" }), _jsx(ThemedText, { children: "Reset your password to regain access to your account." })] }) }));
}
