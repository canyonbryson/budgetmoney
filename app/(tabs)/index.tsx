import { Image, StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import Ionicons from "@expo/vector-icons/Ionicons";
import Button from "@/components/Button";
import { useUser, useAuth } from '@clerk/clerk-expo';
import { ThemedText } from '@/components/ThemedText';
import { t } from '@/i18n';
import { useSettings } from '@/contexts/SettingsContext';

export default function HomeScreen() {
  const { language } = useSettings();
  const { user } = useUser();
  const { signOut } = useAuth();

  const onSignOutPress = async () => {
    try {
      await signOut({ redirectUrl: "/" });
    } catch {}
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="title">{t(language, 'welcome')}</ThemedText>
        <View style={{ gap: 8 }}>
          <ThemedText>
            {t(language, 'signedInAs')}: {user?.emailAddresses?.[0]?.emailAddress}
          </ThemedText>
          <Button onPress={onSignOutPress}>
            {t(language, 'signOut')}
          </Button>
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
