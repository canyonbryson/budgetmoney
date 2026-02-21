import React from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';

type Props = {
  language: string;
  url: string;
  onChangeUrl: (url: string) => void;
  onAutofill: () => Promise<void> | void;
  loading?: boolean;
  error?: string | null;
};

export default function UrlAutofillPanel({
  language,
  url,
  onChangeUrl,
  onAutofill,
  loading = false,
  error,
}: Props) {
  const { colors, spacing, borderRadius } = useAppTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      <ThemedText type="defaultSemiBold">{t(language as any, 'sourceUrl')}</ThemedText>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <TextInput
          style={[
            styles.input,
            { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text },
          ]}
          value={url}
          onChangeText={onChangeUrl}
          placeholder={t(language as any, 'pasteUrlToAutofill')}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Button onPress={onAutofill} disabled={!url.trim() || loading}>
          {t(language as any, 'autofillFromUrl')}
        </Button>
      </View>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <ThemedText style={{ color: colors.error }}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
});
