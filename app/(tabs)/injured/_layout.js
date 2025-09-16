import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Stack } from "expo-router";
export default function InjuredStackLayout() {
    return (_jsxs(Stack, { screenOptions: { headerShown: false }, children: [_jsx(Stack.Screen, { name: "index" }), _jsx(Stack.Screen, { name: "new" }), _jsx(Stack.Screen, { name: "[injuryId]" })] }));
}
