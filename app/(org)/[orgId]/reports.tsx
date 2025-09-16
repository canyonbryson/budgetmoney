import React from "react";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useTranslation } from "@injured/i18n";

export default function OrganizationReports() {
  const { t } = useTranslation();
  return (
    <ThemedView style={{ flex: 1, padding: 16 }}>
      <ThemedText variant="heading">{t("organizationReports")}</ThemedText>
      <ThemedText>{t("organizationReportsDescription")}</ThemedText>
      {/* TODO: Implement organization reports UI */}
    </ThemedView>
  );
}
