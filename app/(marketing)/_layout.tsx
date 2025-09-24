import { Stack } from "expo-router";

export default function MarketingLayout() {
  return (
    <Stack>
      <Stack.Screen name="benefits" options={{ headerShown: false }} />
    </Stack>
  );
}


