import React from 'react';
import { View, Text } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';

export default function OrganizationMembers() {
  return (
    <ThemedView className="flex-1 p-4">
      <ThemedText type="title">Organization Members</ThemedText>
      <ThemedText>Manage members of this organization.</ThemedText>
      {/* TODO: Implement organization members management UI */}
    </ThemedView>
  );
}
