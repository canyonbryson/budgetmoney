import { Stack } from "expo-router";
import React from "react";

export default function InjuredStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ animation: "fade" }} />
      <Stack.Screen name="[injuryId]" options={{ animation: "fade" }} />
    </Stack>
  );
}
