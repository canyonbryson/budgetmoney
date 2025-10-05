import React from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { hexToRgba, LandingAssets, PageIndicator, ThemedButton, ThemedText, useTheme } from "@injured/ui";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Landing4() {
  const router = useRouter();
  const theme = useTheme();

  const handleGetStarted = () => {
    router.push("/(marketing)/landing-5");
  };


  return (
    <ImageBackground
      source={LandingAssets.landing4Background}
      style={styles.container}
      resizeMode="cover"
      imageStyle={styles.image}
    >
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        {/* Gradient overlay */}
        <LinearGradient
          colors={[hexToRgba(theme.colors.background, 0), theme.colors.background]}
          style={styles.gradient}
          locations={[0, 0.55]}
        />

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.textContainer}>
            <ThemedText variant="heading" color={theme.colors.textSecondary} i18nKey="landing4.title" />
            <ThemedText i18nKey="landing4.body" />
          </View>

          <View style={styles.controls}>
            <PageIndicator totalPages={4} currentPage={3} />
            {/* Primary button for the final landing page */}
            <ThemedButton
              i18nKey="getStarted"
              variant="primary"
              size="md"
              fullWidth
              onPress={handleGetStarted}
            />
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },
  image: {
    width: "120%",
  },
  safeArea: {
    flex: 1,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "55%",
  },
  content: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 27,
  },
  textContainer: {
    gap: 25,
  },
  heading: {
    fontFamily: "Inter",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 24,
    color: "#3C3C43",
  },
  body: {
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
    color: "#3C3C43",
  },
  controls: {
    gap: 27,
  },
});

