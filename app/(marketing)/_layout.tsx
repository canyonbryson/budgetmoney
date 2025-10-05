import { Stack } from "expo-router";

export default function MarketingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="loading" />
      <Stack.Screen name="landing-1" />
      <Stack.Screen name="landing-2" />
      <Stack.Screen name="landing-3" />
      <Stack.Screen name="landing-4" />
      <Stack.Screen name="landing-5" />
    </Stack>
  );
}


