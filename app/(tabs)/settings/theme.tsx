import { useTranslation } from "@injured/i18n";
import { ThemedCheckbox, ThemedToggle } from "@injured/ui";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { router } from "expo-router";
import React from "react";
import { StyleSheet, View } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

export default function ThemeSettings() {
  const { t } = useTranslation();
  const {
    theme,
    setTheme,
    contrast,
    setContrast,
    reducedMotion,
    setReducedMotion,
  } = useSettings();

  const isSystem = theme === "system";
  const isDark = theme === "dark";

  return (
    <Screen>
      <ThemedText variant="heading" style={styles.screenTitle}>
        {t("theme")}
      </ThemedText>

      {/* Theme selection */}
      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("selectTheme")}</ThemedText>
        <View style={styles.column}>
          {/* System (checkbox) */}
          <ThemedCheckbox
            checked={isSystem}
            onChange={(checked) => {
              if (checked) setTheme("system");
              else setTheme("light"); // fallback if unchecked
            }}
            label={t("system")}
          />

          {/* Light/Dark (toggle) */}
          <View style={styles.row}>
            <ThemedText>{t("light")}</ThemedText>
            <ThemedToggle
              checked={isDark}
              onValueChange={(next) => setTheme(next ? "dark" : "light")}
            />
            <ThemedText>{t("dark")}</ThemedText>
          </View>
        </View>
      </ThemedView>

      {/* Contrast (checkbox instead of buttons) */}
      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("contrast")}</ThemedText>
        <ThemedText style={styles.description}>
          {t("contrastDescription", {
            defaultValue:
              "High contrast increases color contrast for improved readability and accessibility.",
          })}
        </ThemedText>
        <View style={styles.row}>
          <ThemedCheckbox
            checked={contrast === "high"}
            onChange={(checked) => setContrast(checked ? "high" : "default")}
            label={t("highContrast")}
          />
        </View>
      </ThemedView>

      {/* Reduced motion (already checkbox) */}
      <ThemedView style={styles.section}>
        <ThemedText variant="subheading">{t("reducedMotion")}</ThemedText>
        <ThemedText style={styles.description}>
          {t("reducedMotionDescription", {
            defaultValue:
              "Disable animations and motion effects to reduce visual movement.",
          })}
        </ThemedText>
        <View style={styles.row}>
          <ThemedCheckbox
            checked={!!reducedMotion}
            onChange={(v) => setReducedMotion(!!v)}
            label={
              t("enableReducedMotion", {
                defaultValue: "Enable reduced motion",
              }) as any
            }
          />
        </View>
      </ThemedView>

      {/* Back button */}
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
  column: {
    flexDirection: "column",
    gap: 12,
  },
  description: {
    opacity: 0.8,
  },
});
