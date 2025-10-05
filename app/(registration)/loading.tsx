import React from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ProfilePicture, ThemedScreen, Icons, useThemeContext } from "@injured/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useSettings } from "@/contexts/SettingsContext";

export default function LoadingScreen() {
  const { theme } = useThemeContext();
  const { reducedMotion } = useSettings();
  const router = useRouter();

  React.useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(onboarding)");
    }, 1200);
    return () => clearTimeout(t);
  }, [router]);

  const rotate = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (reducedMotion) {
      rotate.stopAnimation();
      rotate.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion, rotate]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <ThemedScreen centered alignContent="center">
        <ThemedView style={styles.stage}>
          {/* Spinner area */}
          <View style={styles.spinnerArea}>
            <Animated.View style={[styles.layerCenter, { transform: [{ rotate: spin }] }]} pointerEvents="none">
              <Icons.arrows width={260} height={260} color={theme.colors.primary} />
            </Animated.View>
            <View style={styles.layerCenter} pointerEvents="none">
              <ProfilePicture size={120} borderWidth={0} />
            </View>
          </View>

          {/* Copy */}
          <View style={styles.textBlock}>
            <ThemedText i18nKey="loadingTitle" size="3xl" weight="bold">
              Building Your Account
            </ThemedText>
            <ThemedText i18nKey="loadingSubtitle" size="sm">
              It’ll be ready in just a few moments.
            </ThemedText>
          </View>
        </ThemedView>
    </ThemedScreen>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  stage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 30,
  },

  spinnerArea: {
    width: 280,
    height: 280,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  layerCenter: {
    position: "absolute",
    top: 0, right: 0, bottom: 0, left: 0,
    alignItems: "center",
    justifyContent: "center",
  },

  textBlock: { marginTop: 44, alignItems: "center", gap: 8 },
});
