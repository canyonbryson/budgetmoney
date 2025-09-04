import React from 'react';
import Screen from '@/components/ui/Screen';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { StyleSheet } from 'react-native';

export default function InjuredScreen() {
  const { language } = useSettings();
  return (
    <Screen>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>{t(language, 'injured')}</ThemedText>
        <ThemedText style={styles.description}>
          {t(language, 'injuredDescription')}
        </ThemedText>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
});
