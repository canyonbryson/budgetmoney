import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { Branding } from "@injured/ui";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";

const KEY = "hasSeenLandingPage:v1";

export default function Landing5() {
  const router = useRouter();

  const handleCreateAccount = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEY, "true");
    } catch {}
    router.replace("/(registration)/account-creation");
  }, [router]);

  const handleLogin = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEY, "true");
    } catch {}
    router.replace("/(auth)/sign-in");
  }, [router]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <View style={styles.content}>
          {/* Logo and branding section */}
          <View style={styles.brandingSection}>
            <View style={styles.logoContainer}>
              <Branding.logoIcon color={theme.colors.primary} width={130} height={209} />
            </View>

            <View style={styles.titleSection}>
              <View style={styles.titleContainer}>
                <ThemedText
                  style={styles.appTitle}
                  i18nKey="appName"
                />
              </View>

              <ThemedText
                style={styles.subtitle}
                i18nKey="landing5.tagline"
              />
            </View>

            {/* Create Account Button */}
            <ThemedButton
              variant="primary"
              size="md"
              fullWidth
              onPress={handleCreateAccount}
              i18nKey="createAccount"
            />

            {/* Returning User Link */}
            <Pressable onPress={handleLogin} style={styles.loginLink}>
              <ThemedText style={styles.loginText}>
                <ThemedText i18nKey="landing5.returningUser" />
                {" "}
                <ThemedText style={styles.linkText} i18nKey="landing5.logIn" />
              </ThemedText>
            </Pressable>
          </View>

          {/* Healthcare Provider Link (not implemented) */}
          <View style={styles.providerSection}>
            <ThemedText style={styles.providerText}>
              <ThemedText i18nKey="landing5.healthcareProvider" />
              {" "}
              <ThemedText style={styles.linkText} i18nKey="landing5.providerLogin" />
            </ThemedText>
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
    paddingBottom: 30,
    justifyContent: "space-between",
  },
  brandingSection: {
    flex: 1,
    gap: 30,
    justifyContent: "flex-end",
    paddingBottom: 150,
  },
  logoContainer: {
    width: '100%',
    height: 209,
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    gap: 10,
    width: "100%",
    alignItems: "center",
  },
  titleContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 10,
  },
  appTitle: {
    fontFamily: "Inter",
    fontSize: 48,
    fontWeight: "700",
    lineHeight: 48,
    color: "#0F8FEA",
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 14,
    textAlign: "center",
  },
  loginLink: {
    paddingVertical: 5,
  },
  loginText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
  linkText: {
    color: "#0F8FEA",
  },
  providerSection: {
    paddingVertical: 5,
    alignItems: "center",
  },
  providerText: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
});

