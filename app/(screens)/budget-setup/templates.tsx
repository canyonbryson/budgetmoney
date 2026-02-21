import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import ScreenScrollView from '@/components/ScreenScrollView';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { budgetSetupTemplates } from '@/lib/budgetSetupTemplates';

export default function BudgetSetupTemplatesScreen() {
  const { language } = useSettings();
  const { spacing, borderRadius, colors, typography } = useAppTheme();
  const [selectedId, setSelectedId] = React.useState('starter');

  const onContinue = () => {
    router.push({
      pathname: '/(screens)/budget-setup/categories',
      params: { templateId: selectedId },
    });
  };

  return (
    <ScreenScrollView contentContainerStyle={[styles.container, { padding: spacing.lg, gap: spacing.lg }]}>
      <ThemedText type="title">{t(language, 'budgetSetupStepTemplates')}</ThemedText>
      <ThemedText style={{ color: colors.textSecondary }}>{t(language, 'budgetSetupTemplatesHelp')}</ThemedText>

      <View style={{ gap: spacing.sm }}>
        {budgetSetupTemplates.map((template) => {
          const active = template.id === selectedId;
          return (
            <Pressable
              key={template.id}
              onPress={() => setSelectedId(template.id)}
              style={[
                styles.option,
                { borderRadius: borderRadius.md, borderColor: colors.borderLight, padding: spacing.md },
                active && { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
              ]}
            >
              <ThemedText type="defaultSemiBold">{t(language, template.nameKey)}</ThemedText>
              <ThemedText style={[typography.caption, { color: colors.textMuted }]}>
                {t(language, template.descriptionKey)}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <Card>
        <View style={{ gap: spacing.sm }}>
          <Button onPress={onContinue}>{t(language, 'continue')}</Button>
          <Button
            variant="ghost"
            onPress={() => router.push({
              pathname: '/(screens)/budget-setup/categories',
              params: { templateId: 'none' },
            })}
          >
            {t(language, 'budgetSetupSkipTemplates')}
          </Button>
        </View>
      </Card>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  option: {
    borderWidth: 1,
  },
});
