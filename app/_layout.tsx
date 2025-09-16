import "react-native-reanimated";
import 'react-native-gesture-handler'
import 'react-native-svg'

import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";

import { ClerkLoaded, ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { i18n, initI18n } from "@injured/i18n";
import * as Localization from "expo-localization";
import { I18nManager, useColorScheme } from "react-native";
import { ThemeProvider as UIThemeProvider } from "@injured/ui";

// Create a Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  // Fail fast with a clear message if Convex URL is missing
  throw new Error(
    "Missing Convex URL. Please set EXPO_PUBLIC_CONVEX_URL in your .env",
  );
}
const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env",
  );
}

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      if (item) {
        console.log(`${key} was used 🔐 \n`);
      } else {
        console.log("No values stored under key: " + key);
      }
      return item;
    } catch (error) {
      console.error("SecureStore get item error: ", error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      return;
    }
  },
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Pull the device's best locale (e.g., "en-US", "es-MX", "zh-CN", "ar-SA")
const deviceTag = Localization.getLocales?.()[0]?.languageTag;

// Initialize shared i18n using the device tag.
// (Your shared init will normalize to 'en' | 'es' | 'zh-CN' etc.)
initI18n(deviceTag);

// Minimal list of RTL languages in case you add them later.
const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

function InnerApp() {
  const { theme, contrast } = useSettings();
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Sync initial RTL with device and/or current i18n language
  useEffect(() => {
    const twoLetter = i18n.language?.toLowerCase().split("-")[0] ?? "";
    const shouldRTL =
      Localization.getLocales()?.[0]?.languageScriptCode === "Arab" ||
      RTL_LANGS.has(twoLetter);
    if (I18nManager.isRTL !== shouldRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(shouldRTL);
      // NOTE: RN requires an app reload for direction changes to fully apply.
      // You can prompt the user to reload, or rely on next reload.
      console.warn("RTL layout direction changed; reload app to fully apply.");
    }
  }, []);

  // If user switches languages in-app, update RTL if needed
  useEffect(() => {
    const handler = (lng: string) => {
      const twoLetter = lng?.toLowerCase().split("-")[0] ?? "";
      const shouldRTL = RTL_LANGS.has(twoLetter);
      if (I18nManager.isRTL !== shouldRTL) {
        I18nManager.allowRTL(true);
        I18nManager.forceRTL(shouldRTL);
        console.warn(
          "RTL layout direction changed; reload app to fully apply.",
        );
      }
    };
    i18n.on("languageChanged", handler);
    return () => {
      i18n.off("languageChanged", handler);
    };
  }, []);

  React.useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const effectiveTheme =
    theme === "system"
      ? colorScheme === "dark"
        ? DarkTheme
        : DefaultTheme
      : theme === "dark"
        ? DarkTheme
        : DefaultTheme;

  // Map app Settings (theme + contrast) to UI theme provider modes
  const baseMode =
    theme === "system"
      ? colorScheme === "dark"
        ? "dark"
        : "light"
      : theme === "dark"
        ? "dark"
        : "light";

  const uiMode = (contrast === "high"
    ? baseMode === "dark"
      ? "highContrastDark"
      : "highContrastLight"
    : baseMode) as any;

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkLoaded>
          <SafeAreaProvider>
            <UIThemeProvider mode={uiMode}>
              <NavigationThemeProvider value={effectiveTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
              </NavigationThemeProvider>
            </UIThemeProvider>
          </SafeAreaProvider>
        </ClerkLoaded>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <InnerApp />
    </SettingsProvider>
  );
}
