import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ImageInput, ProgressBar, BackButton } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HeadshotUpload() {
  const router = useRouter();
  const [imageUri, setImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleUpload = () => {
    // Stub: Will implement image picker later
    console.log("Upload picture");
  };

  const handleTakePhoto = () => {
    // Stub: Will implement camera later
    console.log("Take picture");
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/birthday");
  };

  const handleSkip = () => {
    // Skip and go to next step
    router.push("/(registration)/birthday");
  };

  const totalSteps = 16;
  const currentStep = 5;
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

          {/* Title Section */}
          <View style={styles.titleSection}>
            <ThemedText
              variant="heading"
              size="3xl"
              i18nKey="headshotTitle"
            />
            <ThemedText
              i18nKey="headshotSubtitle"
            />
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Profile Picture Section */}
          <View style={styles.imageSection}>
            <ImageInput
              display="profile"
              uri={imageUri}
              onUpload={handleUpload}
              onTakePhoto={handleTakePhoto}
              allowUpload
              allowCamera
              width={204}
              height={204}
              label={
                <ThemedText i18nKey="yourProfilePicture" style={styles.imageLabel} />
              }
            />
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
            
            <Pressable onPress={handleSkip} style={styles.skipLink}>
              <ThemedText style={styles.skipText} i18nKey="skipForNow" />
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
    gap: 10,
    marginTop: 30,
  },
  imageSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: "400",
  },
  bottomActions: {
    gap: 15,
  },
  skipLink: {
    paddingTop: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  skipText: {
    fontFamily: "SF Pro",
    fontSize: 12,
    fontWeight: "400",
    color: "#0F8FEA",
  },
});


