import { useUser } from "@clerk/clerk-expo";
import { useTranslation } from "@injured/i18n";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { router } from "expo-router";
import React from "react";
import { useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
import { StyleSheet } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { language } = useSettings();

  return (
    <Screen>
      <ThemedText variant="heading" style={styles.screenTitle}>
        {t("settings")}
      </ThemedText>

      <ThemedView style={styles.titleContainer}>
        <ThemedText variant="subheading">
          {t("signedInAs")} {user?.emailAddresses?.[0]?.emailAddress}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("theme")}</ThemedText>
        <ThemedButton onPress={() => router.push("/(tabs)/settings/theme")}>
          {t("themeSettings")}
        </ThemedButton>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("language")}</ThemedText>
        <ThemedButton onPress={() => router.push("/(tabs)/settings/language")}>
          {t("languageSettings")}
        </ThemedButton>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("family")}</ThemedText>
        <ThemedButton onPress={() => router.push("/(modals)/family")}>
          {t("manageFamily")}
        </ThemedButton>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("profile")}</ThemedText>
        <ThemedButton onPress={() => router.push("/(modals)/profile")}>
          {t("editProfile")}
        </ThemedButton>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("notifications")}</ThemedText>
        <ThemedButton onPress={() => router.push("/(modals)/notifications")}>
          {t("notificationSettings")}
        </ThemedButton>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("uiShowcase")}</ThemedText>
        <ThemedButton
          onPress={() => router.push("/(tabs)/settings/ui-primitives")}
        >
          {t("viewUIPrimitives")}
        </ThemedButton>
        <ThemedButton
          onPress={() => router.push("/(tabs)/settings/ui-components")}
        >
          Components Showcase
        </ThemedButton>
        <ThemedButton
          onPress={() => router.push("/(tabs)/settings/data")}
        >
          Data Management
        </ThemedButton>
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
  headerImage: {
    color: "#808080",
    bottom: -90,
    left: -35,
    position: "absolute",
  },
  titleContainer: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 24,
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
