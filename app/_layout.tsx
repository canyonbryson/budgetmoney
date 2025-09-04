import { DarkTheme, DefaultTheme, ThemeProvider } from '../$node_modules/@react-navigation/native/lib/typescript/src/index.js';
import { useFonts } from '../$node_modules/expo-font/build/index.js';
import { Stack } from '../$node_modules/expo-router/build/index.js';
import * as SplashScreen from '../$node_modules/expo-splash-screen/build/index.js';
import React from '../$node_modules/@types/react/index.js';
import '../$node_modules/react-native-reanimated/lib/typescript/index.js';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ClerkLoaded, ClerkProvider, useAuth } from '../$node_modules/@clerk/clerk-expo/dist/index.js';
import * as SecureStore from '../$node_modules/expo-secure-store/build/SecureStore.js'
import { ConvexReactClient } from '../$node_modules/convex/dist/esm-types/react/index.js';
import { ConvexProviderWithClerk } from "../$node_modules/convex/dist/esm-types/react-clerk/index.js";
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext';
import { SafeAreaProvider } from '../$node_modules/react-native-safe-area-context/lib/typescript/src/index.js';

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
  const { theme } = useSettings();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  React.useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const effectiveTheme = theme === 'system' ? (colorScheme === 'dark' ? DarkTheme : DefaultTheme) : (theme === 'dark' ? DarkTheme : DefaultTheme);

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <ClerkLoaded>
          <SafeAreaProvider>

          <ThemeProvider value={effectiveTheme}>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="+not-found" />
              <Stack.Screen name="(screens)/family" options={{
                title: "Family",
                contentStyle: { backgroundColor: 'white' }
              }} />
              <Stack.Screen name="(screens)/profile" options={{
                title: "Profile",
                contentStyle: { backgroundColor: 'white' }
              }} />
              <Stack.Screen name="(screens)/new-workout" options={{
                title: "New workout",
                contentStyle: {
                  backgroundColor: "white"
                }
              }} />
              <Stack.Screen name="(screens)/log-reps/[workoutId]" options={{
                title: "Log reps",
                contentStyle: {
                  backgroundColor: "white",
                  paddingTop: 8
                }
              }} />
              <Stack.Screen name="(screens)/edit-workout/[workoutId]" options={{
                title: "Edit workout",
                contentStyle: {
                  backgroundColor: "white",
                  paddingTop: 8
                }
              }} />
              <Stack.Screen name="(screens)/edit-entry/[entryId]" options={{
                title: "Edit entry",
                contentStyle: {
                  backgroundColor: "white",
                  paddingTop: 8
                }
              }} />
            </Stack>
          </ThemeProvider>
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