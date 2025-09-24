import { api } from "@injured/backend/convex/_generated/api";
import { useTranslation } from "@injured/i18n";
import { useQuery } from "convex/react";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import * as React from "react";
import { View, Platform } from "react-native";

import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function TabLayout() {
  const { isLoading, isAuthenticated } = useCurrentUser();
  const me = useQuery(api.data.users.getMe);
  const activeTabColor = useThemeColor({}, "tabIconSelected");
  const inactiveTabColor = useThemeColor({}, "tabIconDefault");
  const { t } = useTranslation();

  if (isLoading) return null;
  if (me === undefined) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  if (me && me.user && (!me.profile || me.profile.hasBeenOnboarded !== true)) {
    return <Redirect href="/(onboarding)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          alignItems: "center",
          justifyContent: "center",
          alignContent: "center",
          paddingTop: 6,
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
