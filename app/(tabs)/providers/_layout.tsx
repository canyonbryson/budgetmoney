import React from "react";
import { Stack } from "expo-router";

export default function ProvidersStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[providerId]" />
    </Stack>
  );
}
