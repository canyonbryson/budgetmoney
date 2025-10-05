import { useTranslation } from "@injured/i18n";
import {
  ButtonGroup,
  Icons,
  ProviderCard,
  ThemedText,
  ThemedView,
  useTheme,
} from "@injured/ui";
import React from "react";
import { StyleSheet, ScrollView, View } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

type ViewMode = "list" | "map";

interface Provider {
  id: string;
  name: string;
  specialty: string;
  location: string;
  distance?: string;
  rating?: number;
  reviews?: number;
}

// Hardcoded provider data for now
const MOCK_PROVIDERS: Provider[] = [
  {
    id: "1",
    name: "Dr. Sarah Johnson",
    specialty: "Orthopedic Surgeon",
    location: "Mayo Clinic, Rochester, MN",
    distance: "2.3 miles",
  },
  {
    id: "2",
    name: "Dr. Michael Chen",
    specialty: "Sports Medicine",
    location: "Cleveland Clinic, Cleveland, OH",
    distance: "5.1 miles",
  },
  {
    id: "3",
    name: "Dr. Emily Rodriguez",
    specialty: "Physical Therapist",
    location: "Johns Hopkins, Baltimore, MD",
    distance: "1.8 miles",
  },
  {
    id: "4",
    name: "Dr. David Kim",
    specialty: "Orthopedic Surgeon",
    location: "Massachusetts General, Boston, MA",
    distance: "3.2 miles",
  },
];

export default function ProvidersScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");

  const navigateToProvider = React.useCallback(() => {
    // stub
  }, []);

  const callProvider = React.useCallback(() => {
    // stub
  }, []);

  const messageProvider = React.useCallback(() => {
    // stub
  }, []);

  const getDirections = React.useCallback(() => {
    // stub
  }, []);

  return (
    <Screen>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="heading" style={styles.title}>
            {t("providers")}
          </ThemedText>
          <ThemedText style={styles.description}>
            {t("providersDescription")}
          </ThemedText>
        </View>

        {/* View Toggle */}
        <View style={styles.toggleContainer}>
          <ButtonGroup
            options={[
              {
                key: "list",
                label: "List View",
                iconLeft: <Icons.list width={16} height={16} color={theme.colors.iconSecondary} />,
              },
              {
                key: "map",
                label: "Map View",
                iconLeft: <Icons.map width={16} height={16} color={theme.colors.iconSecondary} />,
              },
            ]}
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            layout="tabs"
            size="sm"
            fullWidth
          />
        </View>

        {/* Providers List */}
        <ScrollView
          style={styles.providersList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.providersContent}
        >
          {MOCK_PROVIDERS.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onPress={navigateToProvider}
              onCall={callProvider}
              onMessage={messageProvider}
              onDirections={getDirections}
              style={styles.providerCard}
            />
          ))}
        </ScrollView>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    gap: 8,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  toggleContainer: {
    marginBottom: 24,
  },
  providersList: {
    flex: 1,
  },
  providersContent: {
    gap: 16,
    paddingBottom: 20,
  },
  providerCard: {
    marginBottom: 0,
  },
});
