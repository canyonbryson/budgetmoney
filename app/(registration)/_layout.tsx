import { Stack } from "expo-router";

export default function RegistrationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="account-creation" />
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify-phone" />
      <Stack.Screen name="email" />
      <Stack.Screen name="full-name" />
      <Stack.Screen name="headshot" />
      <Stack.Screen name="birthday" />
      <Stack.Screen name="gender" />
      <Stack.Screen name="height" />
      <Stack.Screen name="weight" />
      <Stack.Screen name="insurance" />
      <Stack.Screen name="location" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="activity-level" />
      <Stack.Screen name="sports" />
      <Stack.Screen name="pathway" />
      <Stack.Screen name="membership" />
    </Stack>
  );
}


