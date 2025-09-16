import React from "react";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useTranslation } from "@injured/i18n";

export default function NotificationsScreen() {
  const { t } = useTranslation();
  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText variant="heading">{t("notifications")}</ThemedText>
      <ThemedText>{t("notificationsDescription")}</ThemedText>
      {/* TODO: Implement notification settings UI */}
    </ThemedView>
  );
}
