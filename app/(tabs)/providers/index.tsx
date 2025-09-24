import { useTranslation } from "@injured/i18n";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import React from "react";
import { StyleSheet } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

export default function ProvidersScreen() {
  const { t } = useTranslation();
  const { language } = useSettings();
  return (
    <Screen>
      <ThemedView style={styles.container}>
        <ThemedText variant="heading" style={styles.title}>
          {t("providers")}
        </ThemedText>
        <ThemedText style={styles.description}>
          {t("providersDescription")}
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
});
