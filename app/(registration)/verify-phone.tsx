import React from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, useThemeContext } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VerifyPhone() {
  const router = useRouter();
  const [code, setCode] = React.useState(["", "", "", ""]);
  const inputRefs = React.useRef<(TextInput | null)[]>([]);
  const { theme } = useThemeContext();

  const handleBack = () => {
    router.back();
  };

  const handleVerify = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/email");
  };

  const handleResendCode = () => {
    // Stub: Will implement resend functionality later
    console.log("Resend code");
  };

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next input
    if (text && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace to go to previous input
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const setInputRef = (ref: TextInput | null, index: number): void => {
    inputRefs.current[index] = ref;
  };

  const totalSteps = 16;
  const currentStep = 2;
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
              i18nKey="verifyPhoneTitle"
            />
            <ThemedText
              i18nKey="verifyPhoneSubtitle"
            />
          </View>

          {/* Code Input Boxes */}
          <View style={styles.codeContainer}>
            <View style={styles.codeInputs}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => setInputRef(ref, index)}
                  style={[styles.codeInput, { backgroundColor: theme.colors.backgroundSecondary, color: theme.colors.primary }]}
                  value={digit}
                  onChangeText={(text) => handleCodeChange(text.slice(-1), index)}
                  onKeyPress={(e) => handleKeyPress(e, index)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            {/* Resend Code Section */}
            <View style={styles.resendSection}>
              <ThemedText
                style={styles.didntReceiveText}
                i18nKey="didntReceiveCode"
              />
              <Pressable onPress={handleResendCode}>
                <ThemedText
                  style={styles.resendCodeText}
                  i18nKey="resendCode"
                />
              </Pressable>
            </View>
          </View>

          {/* Spacer to push button to bottom */}
          <View style={{ flex: 1 }} />

          {/* Verify Button */}
          <ThemedButton
            variant="primary"
            size="md"
            fullWidth
            onPress={handleVerify}
            i18nKey="verifyPhoneNumber"
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
    gap: 15,
    marginTop: 30,
  },
  codeContainer: {
    gap: 40,
    marginTop: 100,
  },
  codeInputs: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
  },
  codeInput: {
    width: 57,
    height: 80,
    borderRadius: 16,
    textAlign: "center",
    fontSize: 32,
    fontWeight: "700",
    fontFamily: "Inter",
  },
  resendSection: {
    gap: 15,
    alignItems: "center",
  },
  didntReceiveText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    color: "#999999",
    textAlign: "center",
  },
  resendCodeText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "700",
    color: "#0F8FEA",
    textAlign: "center",
  },
});


