import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import React from 'react';
import { useUser } from '@clerk/clerk-expo';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { router } from 'expo-router';

export default function Settings() {
  const { user } = useUser();
  const { language, setLanguage, theme, setTheme } = useSettings();

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={<Ionicons size={310} name="cog" style={styles.headerImage} />}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">{t(language, 'settings')}</ThemedText>
          <ThemedText type="defaultSemiBold">{t(language, 'signedInAs')} {user?.emailAddresses?.[0]?.emailAddress}</ThemedText>
        </ThemedView>

        <ThemedView style={{ gap: 8 }}>
          <ThemedText type="subtitle">{t(language, 'theme')}</ThemedText>
          <View style={styles.row}>
            <Button onPress={() => setTheme('system')} disabled={theme === 'system'}>
              {t(language, 'system')}
            </Button>
            <Button onPress={() => setTheme('light')} disabled={theme === 'light'}>
              {t(language, 'light')}
            </Button>
            <Button onPress={() => setTheme('dark')} disabled={theme === 'dark'}>
              {t(language, 'dark')}
            </Button>
          </View>
        </ThemedView>

        <ThemedView style={{ gap: 8 }}>
          <ThemedText type="subtitle">{t(language, 'language')}</ThemedText>
          <View style={styles.row}>
            <Button onPress={() => setLanguage('en')} disabled={language === 'en'}>EN</Button>
            <Button onPress={() => setLanguage('es')} disabled={language === 'es'}>ES</Button>
            <Button onPress={() => setLanguage('zh-cn')} disabled={language === 'zh-cn'}>ZH</Button>
          </View>
        </ThemedView>

        <ThemedView style={{ gap: 8 }}>
          <ThemedText type="subtitle">Family</ThemedText>
          <Button onPress={() => router.push('/(screens)/family')}>Manage family</Button>
        </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  }
});