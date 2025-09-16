import React from "react";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import Screen from "@/components/ui/Screen";

export default function ForgotPasswordScreen() {
  return (
    <Screen>
      <ThemedView style={{ flex: 1, padding: 16 }}>
        <ThemedText variant="heading">Forgot Password</ThemedText>
        <ThemedText>
          Reset your password to regain access to your account.
        </ThemedText>
        {/* TODO: Implement forgot password form with email input and reset functionality */}
      </ThemedView>
    </Screen>
  );
}
