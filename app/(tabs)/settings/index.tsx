import Ionicons from '../../../$node_modules/@expo/vector-icons/Ionicons.js';
import { StyleSheet, View } from 'react-native';

import Screen from '@/components/ui/Screen.js';
import { ThemedText } from '@/components/ui/ThemedText.js';
import { ThemedView } from '@/components/ui/ThemedView.js';
import React from 'react';
import { useUser } from '@clerk/clerk-expo';
import Button from '@/components/ui/Button.js';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { router } from 'expo-router';

export default function Settings() {
  const { user } = useUser();
  const { language } = useSettings();

  return (
    <Screen>
      <ThemedText type="title" style={styles.screenTitle}>{t(language, 'settings')}</ThemedText>

      <ThemedView style={styles.titleContainer}>
        <ThemedText type="defaultSemiBold">{t(language, 'signedInAs')} {user?.emailAddresses?.[0]?.emailAddress}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">{t(language, 'theme')}</ThemedText>
        <Button onPress={() => router.push('/(tabs)/settings/theme')}>
          {t(language, 'themeSettings')}
        </Button>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">{t(language, 'language')}</ThemedText>
        <Button onPress={() => router.push('/(tabs)/settings/language')}>
          {t(language, 'languageSettings')}
        </Button>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Family</ThemedText>
        <Button onPress={() => router.push('/(modals)/family')}>Manage family</Button>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Profile</ThemedText>
        <Button onPress={() => router.push('/(modals)/profile')}>Edit profile</Button>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Notifications</ThemedText>
        <Button onPress={() => router.push('/(modals)/notifications')}>Notification settings</Button>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'column',
    gap: 8,
    marginBottom: 24,
  },
  section: {
    gap: 12,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  }
});
