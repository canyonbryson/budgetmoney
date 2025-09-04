import React from 'react';
import { View, Text } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import Screen from '@/components/ui/Screen';

export default function NewInjuryScreen() {
  return (
    <Screen>
      <ThemedView className="flex-1 p-4">
        <ThemedText type="title">New Injury</ThemedText>
        <ThemedText>Create a new injury record.</ThemedText>
        {/* TODO: Implement new injury form */}
      </ThemedView>
    </Screen>
  );
}
