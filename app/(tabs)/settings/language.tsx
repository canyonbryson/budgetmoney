import { StyleSheet, View } from 'react-native';
import Screen from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import React from 'react';
import Button from '@/components/ui/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { router } from 'expo-router';

export default function LanguageSettings() {
  const { language, setLanguage } = useSettings();

  return (
    <Screen>
      <ThemedText type="title" style={styles.screenTitle}>{t(language, 'language')}</ThemedText>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">{t(language, 'selectLanguage')}</ThemedText>
        <View style={styles.row}>
          <Button onPress={() => setLanguage('en')} disabled={language === 'en'}>EN</Button>
          <Button onPress={() => setLanguage('es')} disabled={language === 'es'}>ES</Button>
          <Button onPress={() => setLanguage('zh-cn')} disabled={language === 'zh-cn'}>ZH</Button>
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
