import { useUser, useAuth } from "@clerk/clerk-expo";
import { useTranslation } from "@injured/i18n";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import React from "react";
import { StyleSheet, View } from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

// Inside your screen JSX:

export default function HomeScreen() {
  const { language } = useSettings();
  const { t } = useTranslation();
  const { user } = useUser();
  const { signOut } = useAuth();

  const onSignOutPress = async () => {
    try {
      await signOut({ redirectUrl: "/" });
    } catch {}
  };

  return (
    <Screen>
      <ThemedView style={styles.stepContainer}>
        <ThemedText variant="heading" style={styles.welcomeTitle}>
          {t("welcome")}
        </ThemedText>
        <View style={styles.userInfo}>
          <ThemedText style={styles.signedInText}>
            {t("signedInAs")}: {user?.emailAddresses?.[0]?.emailAddress}
          </ThemedText>
          <ThemedButton onPress={onSignOutPress}>{t("signOut")}</ThemedButton>
        </View>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 24,
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  userInfo: {
    gap: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  signedInText: {
    fontSize: 16,
    opacity: 0.8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
