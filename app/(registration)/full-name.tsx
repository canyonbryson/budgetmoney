import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { FormInput, ProgressBar, BackButton } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function FullNameEntry() {
  const router = useRouter();
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/headshot");
  };

  const totalSteps = 16;
  const currentStep = 4;
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
              i18nKey="fullNameTitle"
            />
            <ThemedText
              i18nKey="fullNameSubtitle"
            />
          </View>

          {/* Form Fields */}
          <View style={styles.formFields}>
            <FormInput
              i18nLabelKey="firstName"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First Name"
              fullWidth
            />
            
            <FormInput
              i18nLabelKey="lastName"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last Name"
              fullWidth
            />
          </View>

          {/* Spacer to push button to bottom */}
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
    gap: 10,
    marginTop: 30,
  },
  formFields: {
    gap: 15,
    marginTop: 30,
  },
});


