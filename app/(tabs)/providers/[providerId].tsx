import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import Screen from '@/components/ui/Screen';

export default function ProviderDetailScreen() {
  const { providerId } = useLocalSearchParams();

  return (
    <Screen>
      <ThemedView className="flex-1 p-4">
        <ThemedText type="title">Provider Details</ThemedText>
        <ThemedText>Provider ID: {providerId}</ThemedText>
        {/* TODO: Implement provider detail view with data fetching */}
      </ThemedView>
    </Screen>
  );
}
