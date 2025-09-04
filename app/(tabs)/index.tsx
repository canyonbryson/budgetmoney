import { Image, StyleSheet, View } from 'react-native';

import Screen from '@/components/ui/Screen';
import { ThemedView } from '@/components/ui/ThemedView';
import React from 'react';
import Ionicons from "@expo/vector-icons/Ionicons";
import Button from "@/components/ui/Button";
import { useUser, useAuth } from '@clerk/clerk-expo';
import { ThemedText } from '@/components/ui/ThemedText';
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
    <Screen>
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="title" style={styles.welcomeTitle}>{t(language, 'welcome')}</ThemedText>
        <View style={styles.userInfo}>
          <ThemedText style={styles.signedInText}>
            {t(language, 'signedInAs')}: {user?.emailAddresses?.[0]?.emailAddress}
          </ThemedText>
          <Button onPress={onSignOutPress}>
            {t(language, 'signOut')}
          </Button>
        </View>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 24,
    paddingTop: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  userInfo: {
    gap: 16,
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  signedInText: {
    fontSize: 16,
    opacity: 0.8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
