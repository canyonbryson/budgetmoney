import { useTranslation } from "@injured/i18n";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import React from "react";

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
