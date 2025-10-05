import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, ProfilePicture, Icons } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GenderSelection() {
  const router = useRouter();
  const [gender, setGender] = React.useState<"female" | "male" | null>(null);
  // TODO: Get user's profile image URI from context or state
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/height");
  };

  const totalSteps = 16;
  const currentStep = 7;
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
                  i18nKey="genderTitle"
                />
              </View>
            </View>
            <ThemedText
              i18nKey="genderSubtitle"
            />
          </View>

          {/* Spacer */}
          <View style={{ height: 50 }} />

          {/* Gender Icon and Selection */}
          <View style={styles.selectionSection}>
            <Icons.gender />
            

            {/* Gender Buttons */}
            <View style={styles.genderButtons}>
              <View style={{flex: 1, width: "100%"}}>
                <ThemedButton
                  variant="secondary"
                  size="md"
                  onPress={() => setGender("female")}
                  i18nKey="female"
                />
              </View>
              <View style={{flex: 1, width: "100%"}}>
                <ThemedButton
                  variant="secondary"
                  size="md"
                  onPress={() => setGender("male")}
                  i18nKey="male"
                />
              </View>
            </View>
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
  selectionSection: {
    alignItems: "center",
    gap: 30,
  },
  iconContainer: {
    width: 195,
    height: 136,
    alignItems: "center",
    justifyContent: "center",
  },
  personIcon: {
    width: 195,
    height: 136,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  person1: {
    position: "absolute",
    left: 20,
    alignItems: "center",
  },
  person2: {
    position: "absolute",
    right: 20,
    alignItems: "center",
  },
  personHead: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#0F8FEA",
  },
  personHead2: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  personBody: {
    width: 70,
    height: 70,
    backgroundColor: "#0F8FEA",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    marginTop: -10,
  },
  personBody2: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    marginTop: -15,
  },
  genderButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  genderButton: {
    flex: 1,
  },
});


