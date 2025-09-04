import React from 'react';
import { View, Text } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';

export default function OrganizationReports() {
  return (
    <ThemedView className="flex-1 p-4">
      <ThemedText type="title">Organization Reports</ThemedText>
      <ThemedText>View and generate reports for this organization.</ThemedText>
      {/* TODO: Implement organization reports UI */}
    </ThemedView>
  );
}
