import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Redirect } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Tabs } from "expo-router";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "react-native";
export default function AuthRoutesLayout() {
    const colorScheme = useColorScheme();
    const { isSignedIn } = useAuth();
    if (isSignedIn) {
        return _jsx(Redirect, { href: "/" });
    }
    return (_jsxs(Tabs, { screenOptions: {
            tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
            headerShown: false,
        }, children: [_jsx(Tabs.Screen, { name: "sign-in", options: {
                    title: "Sign in",
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "person" : "person-outline", color: color })),
                    headerShown: false,
                } }), _jsx(Tabs.Screen, { name: "sign-up", options: {
                    title: "Sign up",
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "person-add" : "person-add-outline", color: color })),
                    headerShown: false,
                } })] }));
}
