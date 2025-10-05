import { Stack } from "expo-router";

export default function MarketingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding-1" />
      <Stack.Screen name="onboarding-2" />
      <Stack.Screen name="onboarding-3" />
      <Stack.Screen name="onboarding-4" />
      <Stack.Screen name="onboarding-5" />
    </Stack>
  );
}


