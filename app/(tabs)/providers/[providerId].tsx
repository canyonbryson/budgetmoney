import React from "react";
import { View, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import Screen from "@/components/ui/Screen";
import { useTranslation } from "@injured/i18n";

export default function ProviderDetailScreen() {
  const { providerId } = useLocalSearchParams();
  const { t } = useTranslation();

  return (
    <Screen>
      <ThemedView style={{ flex: 1, padding: 16 }}>
        <ThemedText variant="heading">{t("providerDetails")}</ThemedText>
        <ThemedText>
          {t("providerId")}: {providerId}
        </ThemedText>
        {/* TODO: Implement provider detail view with data fetching */}
      </ThemedView>
    </Screen>
  );
}
