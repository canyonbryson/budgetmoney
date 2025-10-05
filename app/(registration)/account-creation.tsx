import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { Branding, Icons, useThemeContext } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";

export default function AccountCreation() {
  const router = useRouter();
  const {theme} = useThemeContext();

  const handleSignUpWithApple = () => {
    // Stub: Will implement OAuth later
    router.push("/(registration)/phone");
  };

  const handleSignUpWithGoogle = () => {
    // Stub: Will implement OAuth later
    router.push("/(registration)/phone");
  };

  const handleContinueWithPhone = () => {
    router.push("/(registration)/phone");
  };

  const handleLogin = () => {
    router.replace("/(auth)/sign-in");
  };

  return (
    <ThemedView style={styles.container}>
        <View style={styles.content}>
          {/* Logo and Title Section */}
          <View style={styles.topSection}>
            <View style={styles.logoContainer}>
              <Branding.logoIcon color={theme.colors.primary} width={85} height={136} />
            </View>

            <View style={styles.titleSection}>
              <ThemedText
                i18nKey="createAccountTitle"
                size="3xl"
                weight="bold"
              />
              <ThemedText
                i18nKey="createAccountSubtitle"
              />
            </View>

            {/* OAuth Buttons */}
            <View style={styles.oauthButtons}>
              <Pressable
                style={[styles.oauthButton, { borderColor: theme.colors.border }]}
                onPress={handleSignUpWithApple}
              >
                <Ionicons name="logo-apple" size={24} color={theme.colors.iconSecondary} />
                <ThemedText i18nKey="signUpWithApple" />
              </Pressable>

              <Pressable
                style={[styles.oauthButton, { borderColor: theme.colors.border }]}
                onPress={handleSignUpWithGoogle}
              >
                <Icons.google size={20} />
                <ThemedText i18nKey="signUpWithGoogle" />
              </Pressable>
            </View>

            {/* Phone Number Link */}
            <Pressable
              style={styles.phoneLink}
              onPress={handleContinueWithPhone}
            >
              <ThemedText style={styles.phoneLinkText}>
                <ThemedText i18nKey="continueWith" />{"  "}
                <ThemedText style={{ color: theme.colors.primary }} i18nKey="phoneNumber" />
              </ThemedText>
            </Pressable>
          </View>

          {/* Bottom Login Link */}
          <Pressable onPress={handleLogin} style={styles.loginLink}>
            <ThemedText style={styles.loginText}>
              <ThemedText i18nKey="alreadyUser" />
              {" "}
              <ThemedText style={styles.linkText} i18nKey="login" />
            </ThemedText>
          </Pressable>
        </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
    justifyContent: "space-between",
  },
  topSection: {
    flex: 1,
    gap: 40,
    justifyContent: "center",
    // paddingBottom: 120,
  },
  logoContainer: {
    width: "100%",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    gap: 10,
    alignItems: "center",
  },
  oauthButtons: {
    gap: 30,
    width: "100%",
  },
  oauthButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  oauthButtonText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
  },
  phoneLink: {
    paddingVertical: 5,
    alignItems: "center",
  },
  phoneLinkText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
  linkText: {
    color: "#0F8FEA",
  },
  loginLink: {
    paddingVertical: 5,
    alignItems: "center",
  },
  loginText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
});

