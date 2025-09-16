import * as React from "react";
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

  return (
    <Tabs
      screenOptions={{
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
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              tint="light"
              intensity={30}
              style={{
                flex: 1,
                borderRadius: 50,
                overflow: "hidden",
              }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: Colors.light.background,
                borderRadius: 50,
                overflow: "hidden",
              }}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("home"),
          tabBarLabel: t("home"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "home" : "home-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ask-ai"
        options={{
          title: t("askAi"),
          tabBarLabel: t("askAi"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "chatbubble" : "chatbubble-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="injured"
        options={{
          title: t("injured"),
          tabBarLabel: t("injured"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "medkit" : "medkit-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="providers"
        options={{
          title: t("providers"),
          tabBarLabel: t("providers"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "people" : "people-outline"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings"),
          tabBarLabel: t("settings"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "settings" : "settings-outline"}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
