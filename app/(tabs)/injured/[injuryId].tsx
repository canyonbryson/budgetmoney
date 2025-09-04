import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import Screen from '@/components/ui/Screen';

export default function InjuryDetailScreen() {
  const { injuryId } = useLocalSearchParams();

  return (
    <Screen>
      <ThemedView className="flex-1 p-4">
        <ThemedText type="title">Injury Details</ThemedText>
        <ThemedText>Injury ID: {injuryId}</ThemedText>
        {/* TODO: Implement injury detail view with data fetching */}
      </ThemedView>
    </Screen>
  );
}
