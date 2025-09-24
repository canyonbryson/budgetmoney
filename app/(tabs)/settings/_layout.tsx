import { Stack } from "expo-router";
import React from "react";

export default function SettingsStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="language" options={{ animation: "fade" }} />
      <Stack.Screen name="theme" options={{ animation: "fade" }} />
      <Stack.Screen name="ui-primitives" options={{ animation: "fade" }} />
      <Stack.Screen name="ui-components" options={{ animation: "fade" }} />
      <Stack.Screen name="data" options={{ animation: "fade" }} />
    </Stack>
  );
}
