import React from "react";
import { View, StyleSheet, TextInput } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, ProfilePicture, HeightInput } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HeightInputScreen() {
  const router = useRouter();
  const [feet, setFeet] = React.useState("");
  const [inches, setInches] = React.useState("");
  // TODO: Get user's profile image URI from context or state
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/weight");
  };

  const totalSteps = 16;
  const currentStep = 8;
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
                  i18nKey="heightTitle"
                />
              </View>
            </View>
            <ThemedText
              i18nKey="heightSubtitle"
            />
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Height Input Section */}
          <View style={styles.heightSection}>
            <HeightInput
              feet={feet ? Number(feet) : undefined}
              inches={inches ? Number(inches) : undefined}
              onChange={(next) => {
                setFeet(next.feet ? String(next.feet) : "");
                setInches(next.inches ? String(next.inches) : "");
              }}
            />
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Continue Button */}
          <ThemedButton
            variant="primary"
            size="md"
            fullWidth
            onPress={handleContinue}
            i18nKey="continue"
          />
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
  heightSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  heightInputs: {
    flexDirection: "row",
    gap: 20,
    justifyContent: "center",
  },
  heightField: {
    gap: 10,
    alignItems: "center",
  },
  heightInput: {
    width: 63,
    height: 44,
    backgroundColor: "#F8F9FA",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
  heightLabel: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
});


