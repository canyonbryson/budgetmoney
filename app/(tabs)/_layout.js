import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { View, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Colors } from "@/constants/Colors";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useTranslation } from "@injured/i18n";
export default function TabLayout() {
    const activeTabColor = useThemeColor({}, "tabIconSelected");
    const inactiveTabColor = useThemeColor({}, "tabIconDefault");
    const { t } = useTranslation();
    return (_jsxs(Tabs, { screenOptions: {
            headerShown: false,
            tabBarStyle: {
                alignItems: "center",
                justifyContent: "center",
                'alignContent': "center",
                'paddingTop': 6,
                height: 66,
                borderRadius: 50,
                borderWidth: 1,
                marginHorizontal: 12,
                marginBottom: 22,
                position: "absolute",
                backgroundColor: "transparent",
            },
            tabBarActiveTintColor: activeTabColor,
            tabBarInactiveTintColor: inactiveTabColor,
            tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: "500",
            },
            tabBarBackground: () => Platform.OS === "ios" ? (_jsx(BlurView, { tint: "light", intensity: 30, style: {
                    flex: 1,
                    borderRadius: 50,
                    overflow: "hidden",
                } })) : (_jsx(View, { style: {
                    flex: 1,
                    backgroundColor: Colors.light.background,
                    borderRadius: 50,
                    overflow: "hidden",
                } })),
        }, children: [_jsx(Tabs.Screen, { name: "index", options: {
                    title: t("home"),
                    tabBarLabel: t("home"),
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "home" : "home-outline", color: color })),
                } }), _jsx(Tabs.Screen, { name: "ask-ai", options: {
                    title: t("askAi"),
                    tabBarLabel: t("askAi"),
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "chatbubble" : "chatbubble-outline", color: color })),
                } }), _jsx(Tabs.Screen, { name: "injured", options: {
                    title: t("injured"),
                    tabBarLabel: t("injured"),
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "medkit" : "medkit-outline", color: color })),
                } }), _jsx(Tabs.Screen, { name: "providers", options: {
                    title: t("providers"),
                    tabBarLabel: t("providers"),
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "people" : "people-outline", color: color })),
                } }), _jsx(Tabs.Screen, { name: "settings", options: {
                    title: t("settings"),
                    tabBarLabel: t("settings"),
                    tabBarIcon: ({ color, focused }) => (_jsx(TabBarIcon, { name: focused ? "settings" : "settings-outline", color: color })),
                } })] }));
}
