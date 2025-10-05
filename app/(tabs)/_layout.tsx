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
import { Branding, Icons, useTheme } from "@injured/ui/src";

export default function TabLayout() {
  const { isLoading, isAuthenticated } = useCurrentUser();
  const me = useQuery(api.data.users.getMe);
  const { t } = useTranslation();
  const theme = useTheme();

  const activeTabColor = theme.colors.primary;
  const inactiveTabColor = theme.colors.iconSecondary;

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
          paddingTop: 14,
          height: 66,
          borderRadius: 50,
          borderWidth: 1,
          marginHorizontal: 20,
          marginBottom: 30,
          position: "absolute",
          backgroundColor: "transparent",
        },
        tabBarActiveTintColor: activeTabColor,
        tabBarInactiveTintColor: inactiveTabColor,
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
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <Icons.home width={36} height={36} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask-ai"
        options={{
          title: t("askAi"),
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <Icons.chat width={36} height={36} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="injured"
        options={{
          title: t("injured"),
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ width: 50, height: 50, borderRadius: 99, overflow: "hidden", backgroundColor: focused ? color : theme.colors.border, justifyContent: "center", alignItems: "center" }}>
                <Branding.logoIcon width={24} height={36} color={focused ? "white" : theme.colors.iconSecondary} />
              </View>
          ),
        }}
      />
      <Tabs.Screen
        name="providers"
        options={{
          title: t("providers"),
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <Icons.provider width={36} height={36} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("settings"),
          tabBarLabel: '',
          tabBarIcon: ({ color, focused }) => (
            <Icons.settings width={36} height={36} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
