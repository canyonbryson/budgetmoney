import React from 'react';
import { View, Text } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import Screen from '@/components/ui/Screen';

export default function ForgotPasswordScreen() {
  return (
    <Screen>
      <ThemedView className="flex-1 p-4">
        <ThemedText type="title">Forgot Password</ThemedText>
        <ThemedText>Reset your password to regain access to your account.</ThemedText>
        {/* TODO: Implement forgot password form with email input and reset functionality */}
      </ThemedView>
    </Screen>
  );
}
