import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, ProfilePicture, useTranslate } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { Icons } from "@injured/ui";

type ActivityLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface ActivityData {
  titleKey: string;
  descKey: string;
  color: string;
  // TODO: Add icon components for other levels
  icon?: React.ComponentType<{ width: number; height: number }>;
}

const ACTIVITY_DATA: Record<ActivityLevel, ActivityData> = {
  1: {  
    titleKey: "sedentary",
    descKey: "sedentaryDesc",
    color: "#E53935",
    icon: Icons.sedentary,
  },
  2: {
    titleKey: "lightlyActive",
    descKey: "lightlyActiveDesc",
    color: "#E53935",
    icon: Icons.lightlyActive,
  },
  3: {
    titleKey: "moderatelyActive",
    descKey: "moderatelyActiveDesc",
    color: "#FC0",
    icon: Icons.moderatelyActive,
  },
  4: {
    titleKey: "veryActive",
    descKey: "veryActiveDesc",
    color: "#34C759",
    icon: Icons.veryActive,
  },
  5: {
    titleKey: "extremelyActive",
    descKey: "extremelyActiveDesc",
    color: "#34C759",
    icon: Icons.competitive,
  },
  6: {
    titleKey: "athlete",
    descKey: "athleteDesc",
    color: "#34C759",
    icon: Icons.elite,
  },
};

export default function ActivityLevelInputScreen() {
  const router = useRouter();
  const t = useTranslate();
  const [activityLevel, setActivityLevel] = React.useState<ActivityLevel>(1);
  // TODO: Get user's profile image URI from context or state
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/sports");
  };

  const totalSteps = 16;
  const currentStep = 13;
  const progressPercent = (currentStep / totalSteps) * 100;

  const currentData = ACTIVITY_DATA[activityLevel];
  const CurrentIcon = currentData.icon;

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
                  i18nKey="activityLevelTitle"
                />
              </View>
            </View>
            <ThemedText
              i18nKey="activityLevelSubtitle"
            />
          </View>

          {/* Activity Level Display */}
          <View style={styles.activityDisplay}>
            {/* Icon */}
            <View style={styles.iconContainer}>
              {CurrentIcon ? (
                <CurrentIcon width={155} height={135} />
              ) : (
                <View style={[styles.placeholderIcon, { borderColor: currentData.color }]}>
                  <ThemedText style={[styles.placeholderText, { color: currentData.color }]}>
                    {activityLevel}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Title and Description */}
            <View style={styles.levelInfo}>
              <ThemedText
                variant="heading"
                style={{fontSize: 24, color: currentData.color}}
                i18nKey={currentData.titleKey}
              />
              <ThemedText
                size="sm"
                style={{textAlign: "center"}}
                i18nKey={currentData.descKey}
              />
            </View>

            {/* Slider */}
            <View style={styles.sliderSection}>
              {/* Level Numbers */}
              <View style={styles.sliderLabels}>
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <ThemedText
                    key={num}
                    size="sm"
                    style={[
                      styles.sliderLabel,
                      activityLevel === num && styles.sliderLabelActive,

                    ]}
                  >
                    {num}
                  </ThemedText>
                ))}
              </View>

              {/* Slider */}
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={6}
                step={1}
                value={activityLevel}
                onValueChange={(value) => setActivityLevel(value as ActivityLevel)}
                minimumTrackTintColor="#0F8FEA"
                maximumTrackTintColor="#CCCCCC"
                thumbTintColor="#0F8FEA"
              />
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
  activityDisplay: {
    gap: 30,
    alignItems: "center",
    marginTop: 30,
  },
  iconContainer: {
    width: 155,
    height: 135,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderIcon: {
    width: 155,
    height: 135,
    borderWidth: 3,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 48,
    fontWeight: "700",
  },
  levelInfo: {
    gap: 5,
    alignItems: "center",
    width: "100%",
  },
  levelTitle: {
    fontFamily: "Inter",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  levelDescription: {
    fontFamily: "SF Pro",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    color: "#3C3C43",
  },
  sliderSection: {
    gap: 10,
    width: "100%",
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
  },
  sliderLabel: {
    textAlign: "center",
  },
  sliderLabelActive: {
    fontWeight: "bold",
    color: "#0F8FEA",
  },
  slider: {
    width: "100%",
    height: 36,
  },
});


