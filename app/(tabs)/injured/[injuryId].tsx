import { useTranslation } from "@injured/i18n";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useLocalSearchParams } from "expo-router";
import React from "react";

import Screen from "@/components/ui/Screen";

export default function InjuryDetailScreen() {
  const { injuryId } = useLocalSearchParams();
  const { t } = useTranslation();

  return (
    <Screen>
      <ThemedView style={{ flex: 1, padding: 16 }}>
        <ThemedText variant="heading">{t("injuryDetails")}</ThemedText>
        <ThemedText>
          {t("injuryId")}: {injuryId}
        </ThemedText>
        {/* TODO: Implement injury detail view with data fetching */}
      </ThemedView>
    </Screen>
  );
}
