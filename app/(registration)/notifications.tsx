import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, ProfilePicture, Icons, useThemeContext } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NotificationsPreferenceScreen() {
  const router = useRouter();
  const { theme } = useThemeContext();
  // TODO: Get user's profile image URI from context or state
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement notification permission request later
    router.push("/(registration)/activity-level");
  };

  const handleMaybeLater = () => {
    // Skip notifications for now
    router.push("/(registration)/activity-level");
  };

  const totalSteps = 16;
  const currentStep = 12;
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.content}>
          {/* Header with Back Button and Progress */}
          <View style={styles.header}>
            <BackButton onBack={handleBack} />
            <View style={styles.progressContainer}>
              <ProgressBar
                value={progressPercent}
                height={10}
                variant="primary"
                appearance="solid"
                trackColor="#999999"
                progressColor="#34C759"
              />
            </View>
          </View>

          {/* Title Section with Profile Picture */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <ProfilePicture uri={profileImageUri} size={77} borderWidth={0} />
              <View style={styles.titleTextContainer}>
                <ThemedText
                  variant="heading"
                  size="3xl"
                  i18nKey="notificationsTitle"
                />
              </View>
            </View>
            <ThemedText
              i18nKey="notificationsSubtitle"
            />
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Bell Icon */}
          <View style={styles.iconContainer}>
            <Icons.bellBadge width={158} height={191} />
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <ThemedButton
              variant="primary"
              size="md"
              fullWidth
              onPress={handleContinue}
              i18nKey="continue"
            />
            
            <Pressable onPress={handleMaybeLater} style={styles.laterLink}>
              <ThemedText variant="link" size="sm" style={{textAlign: "center"}} i18nKey="maybeLater" />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  header: {
    gap: 30,
  },
  progressContainer: {
    width: "100%",
  },
  titleSection: {
    gap: 20,
    marginTop: 30,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleTextContainer: {
    flex: 1,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  bottomActions: {
    gap: 15,
  },
  laterLink: {
    paddingVertical: 5,
  },
  laterText: {
    textAlign: "center",
  },
});


