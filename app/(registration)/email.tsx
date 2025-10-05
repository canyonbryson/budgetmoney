import React from "react";
import { View, StyleSheet } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { FormInput, ProgressBar, BackButton, ButtonGroup } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EmailEntry() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");

  const handleBack = () => {
    router.back();
  };

  const handleVerifyEmail = () => {
    // Stub: Will implement email verification later
    console.log("Verify email");
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/full-name");
  };

  const totalSteps = 16;
  const currentStep = 3;
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
              i18nKey="emailTitle"
            />
            <ThemedText
              i18nKey="emailSubtitle"
            />
          </View>

          {/* Email Input */}
          <View style={styles.formField}>
            <FormInput
              i18nLabelKey="enterYourEmail"
              value={email}
              onChangeText={setEmail}
              validate={(v) => /^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="Email Address"
              fullWidth
            />
          </View>

          {/* Spacer to push buttons to bottom */}
          <View style={{ flex: 1 }} />

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <View style={{flex: 1, width: "100%"}}>
              <ThemedButton
                variant="secondary"
                size="md"
                onPress={handleVerifyEmail}
                i18nKey="verifyEmail"
              />
            </View>
            <View style={{flex: 1, width: "100%"}}>
              <ThemedButton
                variant="primary"
                size="md"
                onPress={handleContinue}
                i18nKey="continue"
              />
            </View>
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
    gap: 15,
    marginTop: 30,
    marginBottom: 10,
  },
  formField: {
    marginTop: 30,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
});


