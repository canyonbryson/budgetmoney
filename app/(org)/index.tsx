import React from 'react';
import { View, Text } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';

export default function OrganizationDashboard() {
  return (
    <ThemedView className="flex-1 p-4">
      <ThemedText type="title">Organization Dashboard</ThemedText>
      <ThemedText>Manage your organization's settings and view reports.</ThemedText>
      {/* TODO: Implement organization dashboard UI */}
    </ThemedView>
  );
}
