import { useUser, useAuth } from "@clerk/clerk-expo";
import { useTranslation } from "@injured/i18n";
import { ThemedButton, ThemedCard, ThemedText, ThemedView, Icons, useTheme } from "@injured/ui";
import { GlowingInput } from "@injured/ui";
import { router } from "expo-router";
import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
import { StyleSheet, View, TouchableOpacity, ScrollView } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";
import Svg, { Path } from "react-native-svg";

function ChevronRightIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 18l6-6-6-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type SettingSection = {
  id: string;
  title: string;
  items: SettingItem[];
};

type SettingItem = {
  id: string;
  title: string;
  icon: React.ReactNode;
  onPress: () => void;
  showDivider?: boolean;
};

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language } = useSettings();
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    try {
      await signOut({ redirectUrl: "/" });
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const settingSections: SettingSection[] = [
    {
      id: "account-management",
      title: t("accountManagement"),
      items: [
        {
          id: "manage-subscription",
          title: t("manageSubscription"),
          icon: <Icons.subscription width={21} height={15} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Implement subscription management
          },
          showDivider: true,
        },
        {
          id: "change-password",
          title: t("changePassword"),
          icon: <Icons.key width={21} height={20} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Implement password change
          },
          showDivider: true,
        },
        {
          id: "delete-account",
          title: t("deleteAccount"),
          icon: <Icons.personXmark width={21} height={15} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Implement account deletion
          },
        },
      ],
    },
    {
      id: "app-preferences",
      title: t("appPreferences"),
      items: [
        {
          id: "notifications-preferences",
          title: t("notificationsPreferences"),
          icon: <Icons.bellBadge width={21} height={23} color={theme.colors.primary} />,
          onPress: () => router.push("/(modals)/notifications"),
          showDivider: true,
        },
        {
          id: "app-appearance",
          title: t("appAppearance"),
          icon: <Icons.settings width={21} height={21} color={theme.colors.primary} />,
          onPress: () => router.push("/(tabs)/settings/theme"),
          showDivider: true,
        },
        {
          id: "version-information",
          title: t("versionInformation"),
          icon: <Icons.infoCircle width={21} height={21} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Show version information
          },
        },
      ],
    },
    {
      id: "privacy-security",
      title: t("privacySecurity"),
      items: [
        {
          id: "manage-data",
          title: t("manageData"),
          icon: <Icons.list width={21} height={21} color={theme.colors.primary} />,
          onPress: () => router.push("/(tabs)/settings/data"),
          showDivider: true,
        },
        {
          id: "hipaa-notice",
          title: t("hipaaNotice"),
          icon: <Icons.document width={21} height={21} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Show HIPAA notice
          },
          showDivider: true,
        },
        {
          id: "privacy-policy",
          title: t("privacyPolicy"),
          icon: <Icons.handRaised width={21} height={21} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Show privacy policy
          },
          showDivider: true,
        },
        {
          id: "terms-conditions",
          title: t("termsConditions"),
          icon: <Icons.scroll width={21} height={21} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Show terms and conditions
          },
        },
      ],
    },
    {
      id: "support",
      title: t("support"),
      items: [
        {
          id: "help-center",
          title: t("helpCenter"),
          icon: <Icons.questionmarkCircle width={21} height={21} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Show help center
          },
          showDivider: true,
        },
        {
          id: "give-feedback",
          title: t("giveFeedback"),
          icon: <Icons.bubbleExclamation width={21} height={21} color={theme.colors.primary} />,
          onPress: () => {
            // TODO: Show feedback form
          },
        },
      ],
    },
    {
      id: "misc",
      title: t("misc"),
      items: [
        {
          id: "family",
          title: t("family"),
          icon: <Icons.orthoPatient width={20} height={20} color={theme.colors.primary} />,
          onPress: () => router.push("/(modals)/family"),
          showDivider: true,
        },
        {
          id: "profile",
          title: t("profile"),
          icon: <Icons.orthoAthlete width={20} height={20} color={theme.colors.primary} />,
          onPress: () => router.push("/(modals)/profile"),
          showDivider: true,
        },
        {
          id: "landing-pages",
          title: t("landingPages"),
          icon: <Icons.home width={20} height={20} color={theme.colors.primary} />,
          onPress: () => router.push("/(marketing)/loading"),
          showDivider: true,
        },
        {
          id: "registration-pages",
          title: t("registrationPages"),
          icon: <Icons.checkmarkCircle width={20} height={20} color={theme.colors.primary} />,
          onPress: () => router.push("/(registration)/loading"),
          showDivider: true,
        },
        {
          id: "ui-showcase",
          title: t("uiShowcase"),
          icon: <Icons.settings width={20} height={20} color={theme.colors.primary} />,
          onPress: () => router.push("/(tabs)/settings/ui-components"),
        },
      ],
    }
  ];

  return (
    <Screen>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedText size="3xl" weight="bold">
              {t("settings")}
            </ThemedText>
            <ThemedText size="sm" color={theme.colors.mutedForeground}>
              {t("signedInAs")} {user?.emailAddresses?.[0]?.emailAddress}
            </ThemedText>
          </ThemedView>

          {/* Search Bar */}
          <GlowingInput
            leftIcon={<Icons.magnifyingGlass width={20} height={20} color={theme.colors.iconSecondary} />}
            value={searchQuery}
            inputStyle={{ paddingHorizontal: 35 }}
            onChangeText={setSearchQuery}
            placeholder={t("searchSettings")}
            style={styles.searchBar}
            borderColor={theme.colors.iconSecondary}
            reducedMotion={true}
            rightIcon={<Icons.mic style={{ marginTop: 7, marginRight: 5 }} width={14} height={20} color={theme.colors.iconSecondary} />}
          />

          {/* Settings Sections */}
          <ThemedView style={styles.settingsContainer}>
            {settingSections.map((section) => (
              <ThemedView key={section.id} style={styles.section}>
                {/* Section Title */}
                <ThemedText size="lg" weight="semibold" style={styles.sectionTitle}>
                  {section.title}
                </ThemedText>

                {/* Section Card */}
                <ThemedCard variant="glass" padding="20px" margin={0}>
                  <ThemedView style={styles.sectionItems}>
                    {section.items.map((item, index) => (
                      <TouchableOpacity
                        key={item.id}
                        onPress={item.onPress}
                        style={styles.settingItem}
                      >
                        <ThemedView style={styles.settingItemLeft}>
                          {item.icon}
                          <ThemedText size="base" weight="medium">
                            {item.title}
                          </ThemedText>
                        </ThemedView>
                        <ChevronRightIcon color={theme.colors.mutedForeground} size={20} />
                        {item.showDivider && index < section.items.length - 1 && (
                          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ThemedView>
                </ThemedCard>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Logout Button */}
          <ThemedView style={styles.logoutContainer}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <ThemedText size="base" weight="medium" color={theme.colors.primary}>
                {t("logout")}
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  container: {
    gap: 20,
    paddingTop: 20,
  },
  header: {
    gap: 8,
    marginBottom: 10,
  },
  searchBar: {
    marginBottom: 10,
    marginRight: 20,
  },
  settingsContainer: {
    gap: 20,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionItems: {
    gap: 0,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    position: "relative",
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  divider: {
    position: "absolute",
    bottom: 0,
    left: 32,
    right: 0,
    height: 1,
  },
  logoutContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
