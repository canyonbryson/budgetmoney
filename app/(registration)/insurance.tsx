import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, ProfilePicture } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InsuranceInputScreen() {
  const router = useRouter();
  const [hasInsurance, setHasInsurance] = React.useState<boolean>(true);
  const [insuranceCardUri, setInsuranceCardUri] = React.useState<string | null>(null);
  // TODO: Get user's profile image URI from context or state
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleUploadImage = () => {
    // Stub: Will implement image picker later
    console.log("Upload image");
  };

  const handleUseCardOnFile = () => {
    // Stub: Will implement card on file selection later
    console.log("Use card on file");
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/location");
  };

  const totalSteps = 16;
  const currentStep = 10;
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
                  i18nKey="insuranceTitle"
                />
              </View>
            </View>
            <ThemedText
              i18nKey="insuranceSubtitle"
            />
          </View>

          {/* Radio Buttons */}
          <View style={styles.radioSection}>
            <Pressable
              style={styles.radioItem}
              onPress={() => setHasInsurance(true)}
            >
              <View style={styles.radioButton}>
                {hasInsurance && <View style={styles.radioButtonInner} />}
              </View>
              <ThemedText style={styles.radioLabel} i18nKey="yes" />
            </Pressable>

            <Pressable
              style={styles.radioItem}
              onPress={() => setHasInsurance(false)}
            >
              <View style={styles.radioButton}>
                {!hasInsurance && <View style={styles.radioButtonInner} />}
              </View>
              <ThemedText style={styles.radioLabel} i18nKey="no" />
            </Pressable>
          </View>

          {/* Upload Section */}
          {hasInsurance && (
            <View style={styles.uploadSection}>
              <ThemedText style={styles.uploadLabel} i18nKey="uploadInsuranceCard" />
              
              <View style={styles.buttonRow}>
                <View style={styles.uploadButton}>
                <ThemedButton
                  variant="secondary"
                  size="md"
                  onPress={handleUploadImage}
                  i18nKey="uploadImage"
                />
                </View>
                <View style={styles.uploadButton}>
                <ThemedButton
                  variant="secondary"
                  size="md"
                  onPress={handleUseCardOnFile}
                  i18nKey="useCardOnFile"
                />
                </View>
              </View>
            </View>
          )}

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Insurance Card Preview */}
          {hasInsurance && (
            <View style={styles.cardPreview}>
              {insuranceCardUri ? (
                <View style={styles.cardImage}>
                  {/* TODO: Add Image component when card is uploaded */}
                </View>
              ) : (
                <ThemedText
                  style={styles.cardPlaceholder}
                  i18nKey="pictureOfInsuranceCard"
                />
              )}
            </View>
          )}

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
  title: {
    fontFamily: "Inter",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 32,
    color: "#0F8FEA",
  },
  subtitle: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 14,
  },
  radioSection: {
    gap: 10,
    marginTop: 30,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0F8FEA",
    alignItems: "center",
    justifyContent: "center",
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0F8FEA",
  },
  radioLabel: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
  },
  uploadSection: {
    gap: 15,
    marginTop: 30,
  },
  uploadLabel: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  uploadButton: {
    flex: 1,
    width: "100%",
  },
  cardPreview: {
    width: "100%",
    height: 212,
    backgroundColor: "#F8F9FA",
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  cardImage: {
    width: "100%",
    height: "100%",
    borderRadius: 34,
  },
  cardPlaceholder: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
});


