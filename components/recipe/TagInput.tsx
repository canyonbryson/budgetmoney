import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';

type Props = {
  language: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
};

function normalize(value: string) {
  return value.trim();
}

export default function TagInput({ language, tags, onChange, suggestions = [] }: Props) {
  const { colors, spacing, borderRadius, typography } = useAppTheme();
  const [draft, setDraft] = React.useState('');

  const addTag = React.useCallback(
    (raw: string) => {
      const next = normalize(raw);
      if (!next) return;
      if (tags.some((tag) => tag.toLowerCase() === next.toLowerCase())) return;
      onChange([...tags, next]);
    },
    [onChange, tags]
  );

  const removeTag = React.useCallback(
    (tagToRemove: string) => {
      onChange(tags.filter((tag) => tag !== tagToRemove));
    },
    [onChange, tags]
  );

  const onSubmit = () => {
    addTag(draft);
    setDraft('');
  };

  const availableSuggestions = suggestions
    .filter((tag) => !tags.some((current) => current.toLowerCase() === tag.toLowerCase()))
    .slice(0, 10);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.xs }]}>
        {tags.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => removeTag(tag)}
            style={[
              styles.chip,
              {
                borderRadius: borderRadius.pill,
                borderColor: colors.border,
                backgroundColor: colors.primaryMuted,
              },
            ]}
          >
            <ThemedText style={[typography.caption, { color: colors.primary }]}>{tag} ×</ThemedText>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={[
          styles.input,
          {
            borderRadius: borderRadius.sm,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={onSubmit}
        placeholder={t(language as any, 'addTag')}
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
      />

      {availableSuggestions.length > 0 ? (
        <View style={[styles.row, { gap: spacing.xs }]}>
          {availableSuggestions.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => addTag(tag)}
              style={[
                styles.chip,
                {
                  borderRadius: borderRadius.pill,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <ThemedText style={typography.caption}>{tag}</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    height: 42,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
});
