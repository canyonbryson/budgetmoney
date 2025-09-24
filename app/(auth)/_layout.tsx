import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Href, Tabs } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";

import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";

export default function AuthRoutesLayout() {
  const colorScheme = useColorScheme();
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Redirect href={"/" as Href} />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="sign-in"
        options={{
          title: "Sign in",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "person" : "person-outline"}
              color={color}
            />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="sign-up"
        options={{
          title: "Sign up",
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "person-add" : "person-add-outline"}
              color={color}
            />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
