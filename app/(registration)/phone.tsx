import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedCheckbox } from "@injured/ui/ThemedCheckbox";
import { FormInput, ProgressBar, BackButton, PasswordInput } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PhoneEntry() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [biometricEnabled, setBiometricEnabled] = React.useState(true);
  const [agreeHipaa, setAgreeHipaa] = React.useState(false);
  const [agreeTerms, setAgreeTerms] = React.useState(false);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/verify-phone");
  };

  const totalSteps = 16;
  const currentStep = 1;
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
              i18nKey="phoneRegistrationTitle"
            />
            <ThemedText
              i18nKey="phoneRegistrationSubtitle"
            />
          </View>

          {/* Form Fields */}
          <View style={styles.formFields}>
            <FormInput
              i18nLabelKey="enterPhoneNumber"
              value={phoneNumber}
              validate={(v) => /^\d{10}$/.test(v) ? null : "Enter a valid phone number"}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="Phone Number"
              fullWidth
            />
            
            <PasswordInput
              i18nLabelKey="createPassword"
              value={password}
              validate={(v) => v.length >= 8 ? null : "Enter a valid password"}
              onChangeText={setPassword}
              placeholder="Password"
              fullWidth
            />
          </View>

          {/* Checkboxes */}
          <View style={styles.checkboxes}>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setBiometricEnabled(!biometricEnabled)}
            >
              <ThemedCheckbox
                checked={biometricEnabled}
                onChange={setBiometricEnabled}
              />
              <ThemedText
                i18nKey="enableBiometric"
              />
            </Pressable>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setAgreeHipaa(!agreeHipaa)}
            >
              <ThemedCheckbox
                checked={agreeHipaa}
                onChange={setAgreeHipaa}
              />
                <ThemedText i18nKey="agreeHipaa" />&nbsp;
                <ThemedText style={styles.linkText} i18nKey="hipaaStatement" />
            </Pressable>

            <Pressable
              style={styles.checkboxRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
            >
              <ThemedCheckbox
                checked={agreeTerms}
                onChange={setAgreeTerms}
              />
                <ThemedText i18nKey="agreeTerms" />&nbsp;
                <ThemedText style={styles.linkText} i18nKey="termsAndConditions" />
            </Pressable>
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
  checkboxes: {
    gap: 10,
    marginTop: 30,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  checkboxLabel: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 14,
  },
  linkText: {
    color: "#0F8FEA",
  },
});


