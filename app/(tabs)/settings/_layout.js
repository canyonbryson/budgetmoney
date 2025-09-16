import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Stack } from "expo-router";
export default function SettingsStackLayout() {
    return (_jsxs(Stack, { screenOptions: { headerShown: false }, children: [_jsx(Stack.Screen, { name: "index" }), _jsx(Stack.Screen, { name: "language" }), _jsx(Stack.Screen, { name: "theme" }), _jsx(Stack.Screen, { name: "ui-primitives" })] }));
}
