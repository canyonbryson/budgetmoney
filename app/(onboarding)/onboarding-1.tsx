import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  ThemedView,
  ThemedText,
  PageIndicator,
  NextButton,
  useTheme,
  Icons,
  Branding,
} from "@injured/ui";
import { useTranslation } from "@injured/i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";

export default function Onboarding1() {
  const router = useRouter();
  const theme = useTheme();
  const { t } = useTranslation();

  const handleNext = () => router.push("./onboarding-2" as any);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        {/* Background hero icon */}
        <View pointerEvents="none" style={styles.bgIconWrap}>
          <TabBarIcon
            name="home"
            size={250}
            color={theme.colors.primary}
            style={{ opacity: 0.2 }}
          />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Spacer pushes text to mid-lower area like the mock */}
          <View style={{ flex: 1 }} />

          {/* Text content with slight legibility layer */}
          <View style={styles.textBlock}>

            <ThemedText
              size="4xl"
              weight="bold"
              style={styles.title}
              i18nKey="onboarding.homeTitle"
            >
              Your Recovery Hub
            </ThemedText>

            <ThemedText
              style={styles.body}
              i18nKey="onboarding.homeBody"
            >
              Get an instant overview of your healing journey. Track upcoming
              appointments, catch up on important messages, and dive into our
              learning library for expert-backed recovery tips and educational
              resources.
            </ThemedText>
          </View>

          {/* Page controls */}
          <View style={styles.controlsRow}>
            <PageIndicator totalPages={5} currentPage={0} />
            <NextButton onPress={handleNext} size={44} />
          </View>
        </View>

        {/* Bottom Tab Bar Preview (matches your Tabs layout) */}
        <View style={styles.tabBarContainer}>
          <View style={[styles.tabBar, { borderColor: theme.colors.border }]}>
            {Platform.OS === "ios" ? (
              <BlurView tint="light" intensity={30} style={styles.tabBarBg} />
            ) : (
              <View
                style={[
                  styles.tabBarBg,
                  { backgroundColor: Colors.light.background },
                ]}
              />
            )}

            <View style={styles.tabBarContent}>
              <Icons.home width={36} height={36} color={theme.colors.primary} />
              <Icons.chat width={36} height={36} color={theme.colors.iconSecondary} onPress={() => router.push("./onboarding-2" as any)} />
              <View style={{ width: 50, height: 50, borderRadius: 99, overflow: "hidden", backgroundColor: theme.colors.border, justifyContent: "center", alignItems: "center" }}>
                <Branding.logoIcon width={24} height={36} color={theme.colors.iconSecondary} onPress={() => router.push("./onboarding-3" as any)} />
              </View>
              <Icons.provider width={36} height={36} color={theme.colors.iconSecondary} onPress={() => router.push("./onboarding-4" as any)} />
              <Icons.settings width={36} height={36} color={theme.colors.iconSecondary} onPress={() => router.push("./onboarding-5" as any)} />
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },

  /* Large background icon centered on screen */
  bgIconWrap: {
    position: "absolute",
    top: 0, right: 0, bottom: 30, left: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110, // leaves room above the tab-bar preview
    alignItems: "center",
  },

  textBlock: {
    position: "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 30,
  },
  textBlur: {
    position: "absolute",
    top: -16,
    left: -16,
    right: -16,
    bottom: -16,
    borderRadius: 18,
  },
  title: {
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    textAlign: "center",
  },

  controlsRow: {
    flexDirection: "column",
    alignItems: "center",
    gap: 60,
    marginTop: 16,
  },

  /* Tab bar preview — mirrors TabLayout styles */
  tabBarContainer: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 22,
  },
  tabBar: {
    height: 66,
    borderRadius: 50,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 50,
  },
  tabBarContent: {
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
});
