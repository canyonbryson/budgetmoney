import React from 'react';
import { View, Text } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';

export default function NotificationsScreen() {
  return (
    <ThemedView className="flex-1 p-4">
      <ThemedText type="title">Notifications</ThemedText>
      <ThemedText>Push notification settings and preferences.</ThemedText>
      {/* TODO: Implement notification settings UI */}
    </ThemedView>
  );
}
