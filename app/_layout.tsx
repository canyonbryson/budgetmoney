import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store'
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { IdentityProvider } from '@/contexts/IdentityContext';
import { LocalDbProvider } from '@/contexts/LocalDbContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { resolveTheme } from '@/constants/themes';
import type { ColorScheme } from '@/constants/themes';

// Google Fonts — we load every weight referenced in any theme definition
import { Lora_700Bold } from '@expo-google-fonts/lora';
import {
  SourceSans3_400Regular,
  SourceSans3_600SemiBold,
} from '@expo-google-fonts/source-sans-3';
import { Nunito_700Bold } from '@expo-google-fonts/nunito';
import {
  Karla_400Regular,
  Karla_700Bold,
} from '@expo-google-fonts/karla';
import { Sora_700Bold } from '@expo-google-fonts/sora';
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  Outfit_400Regular,
  Outfit_600SemiBold,
} from '@expo-google-fonts/outfit';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';

// Create a Convex client
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  // Fail fast with a clear message if Convex URL is missing
  throw new Error('Missing Convex URL. Please set EXPO_PUBLIC_CONVEX_URL in your .env');
}
const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});


const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!
if (!publishableKey) {
  throw new Error(
    'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env',
  )
}

const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key)
      if (item) {
        console.log(`${key} was used 🔐 \n`)
      } else {
        console.log('No values stored under key: ' + key)
      }
      return item
    } catch (error) {
      console.error('SecureStore get item error: ', error)
      await SecureStore.deleteItemAsync(key)
      return null
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value)
    } catch (err) {
      return
    }
  },
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function InnerApp() {
  const colorScheme = useColorScheme();
  const { theme, brandTheme } = useSettings();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    // Classic
    Lora_700Bold,
    SourceSans3_400Regular,
    SourceSans3_600SemiBold,
    // Ocean
    Nunito_700Bold,
    Karla_400Regular,
    Karla_700Bold,
    // Ember
    Sora_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    // Botanical
    Fraunces_700Bold,
    Outfit_400Regular,
    Outfit_600SemiBold,
    // Noir
    SpaceGrotesk_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  React.useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const effectiveScheme: ColorScheme =
    theme === 'system'
      ? (colorScheme === 'dark' ? 'dark' : 'light')
      : (theme === 'dark' ? 'dark' : 'light');

  const effectiveNavTheme = effectiveScheme === 'dark' ? DarkTheme : DefaultTheme;
  const resolvedAppTheme = resolveTheme(brandTheme, effectiveScheme);

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <IdentityProvider>
          <ClerkLoaded>
            <ThemeProvider theme={resolvedAppTheme}>
              <NavThemeProvider value={effectiveNavTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                  <Stack.Screen name="(screens)/accounts" options={{ title: "Accounts" }} />
                  <Stack.Screen name="(screens)/receipts" options={{ title: "Receipts" }} />
                  <Stack.Screen name="(screens)/receipt/[receiptId]" options={{ title: "Receipt" }} />
                  <Stack.Screen name="(screens)/categories" options={{ title: "Categories" }} />
                  <Stack.Screen name="(screens)/budget-allocate/[categoryId]" options={{ title: "Allocate budget" }} />
                  <Stack.Screen name="(screens)/recipes" options={{ title: "Recipes" }} />
                  <Stack.Screen name="(screens)/meal-plan" options={{ title: "Meal plan" }} />
                  <Stack.Screen name="(screens)/shopping-list" options={{ title: "Shopping list" }} />
                  <Stack.Screen name="(screens)/pantry" options={{ title: "Pantry" }} />
                </Stack>
              </NavThemeProvider>
            </ThemeProvider>
          </ClerkLoaded>
        </IdentityProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <LocalDbProvider>
        <InnerApp />
      </LocalDbProvider>
    </SettingsProvider>
  );
}
