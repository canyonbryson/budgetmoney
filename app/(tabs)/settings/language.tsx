import { useTranslation } from "@injured/i18n";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

export default function LanguageSettings() {
  const { t } = useTranslation();
  const { language, setLanguage } = useSettings();

  return (
    <Screen>
      <ThemedText variant="heading" style={styles.screenTitle}>
        {t("language")}
      </ThemedText>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("selectLanguage")}</ThemedText>
        <View style={styles.row}>
          <ThemedButton
            onPress={() => setLanguage("en")}
            disabled={language === "en"}
          >
            EN
          </ThemedButton>
          <ThemedButton
            onPress={() => setLanguage("es")}
            disabled={language === "es"}
          >
            ES
          </ThemedButton>
          <ThemedButton
            onPress={() => setLanguage("zh-CN")}
            disabled={language === "zh-CN"}
          >
            ZH
          </ThemedButton>
        </View>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedButton onPress={() => router.back()}>{t("back")}</ThemedButton>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 20,
  },
  section: {
    gap: 12,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
});
