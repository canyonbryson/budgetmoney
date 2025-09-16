import React from "react";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import Screen from "@/components/ui/Screen";
import { useTranslation } from "@injured/i18n";

export default function NewInjuryScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ThemedView style={{ flex: 1, padding: 16 }}>
        <ThemedText variant="heading">{t("newInjury")}</ThemedText>
        <ThemedText>{t("newInjuryDescription")}</ThemedText>
        {/* TODO: Implement new injury form */}
      </ThemedView>
    </Screen>
  );
}
