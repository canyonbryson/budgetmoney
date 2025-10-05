import React from "react";
import { View, Image, ImageBackground, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { LandingAssets } from "@injured/ui";

export default function LoadingScreen() {
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;

  React.useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(marketing)/landing-1");
    }, 1200);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ImageBackground
      source={LandingAssets.background}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <Image
          source={LandingAssets.logo}
          style={[styles.logo, { width: screenWidth - 40 }]}
          resizeMode="contain"
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#A8C5D1",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logo: {
    height: "100%",
  },
});

