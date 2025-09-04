import { StyleSheet, View } from 'react-native';
import Screen from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import React from 'react';
import Button from '@/components/ui/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { router } from 'expo-router';

export default function ThemeSettings() {
  const { language, theme, setTheme } = useSettings();

  return (
    <Screen>
      <ThemedText type="title" style={styles.screenTitle}>{t(language, 'theme')}</ThemedText>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">{t(language, 'selectTheme')}</ThemedText>
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

      <ThemedView style={styles.section}>
        <Button onPress={() => router.back()}>
          {t(language, 'back')}
        </Button>
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
