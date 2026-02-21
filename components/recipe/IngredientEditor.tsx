import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import Button from '@/components/Button';
import { ThemedText } from '@/components/ThemedText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { t } from '@/i18n';

export type IngredientDraft = {
  id?: string;
  name: string;
  quantity: string;
  unit: string;
};

type Props = {
  language: string;
  editing: boolean;
  value: IngredientDraft[];
  onChange: (value: IngredientDraft[]) => void;
  missingAmountIndexes?: number[];
};

export default function IngredientEditor({
  language,
  editing,
  value,
  onChange,
  missingAmountIndexes = [],
}: Props) {
  const { colors, spacing, borderRadius } = useAppTheme();
  const missingSet = React.useMemo(() => new Set(missingAmountIndexes), [missingAmountIndexes]);

  const updateRow = (index: number, patch: Partial<IngredientDraft>) => {
    onChange(value.map((row, idx) => (idx === index ? { ...row, ...patch } : row)));
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {value.length ? (
        value.map((ingredient, index) => (
          <View key={ingredient.id ?? `${ingredient.name}-${index}`} style={[styles.row, { gap: spacing.xs }]}>
            {editing ? (
              <>
                <TextInput
                  style={[
                    styles.input,
                    styles.name,
                    { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text },
                  ]}
                  value={ingredient.name}
                  onChangeText={(name) => updateRow(index, { name })}
                  placeholder={t(language as any, 'itemName')}
                  placeholderTextColor={colors.textMuted}
                />
                <View style={{ gap: 4 }}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.compact,
                      {
                        borderRadius: borderRadius.sm,
                        borderColor: missingSet.has(index) ? colors.error : colors.border,
                        color: colors.text,
                      },
                    ]}
                    value={ingredient.quantity}
                    onChangeText={(quantity) => updateRow(index, { quantity })}
                    placeholder={t(language as any, 'quantity')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                  {missingSet.has(index) ? (
                    <ThemedText style={[styles.errorText, { color: colors.error }]}>
                      {t(language as any, 'ingredientAmountRequired')}
                    </ThemedText>
                  ) : null}
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.compact,
                    { borderRadius: borderRadius.sm, borderColor: colors.border, color: colors.text },
                  ]}
                  value={ingredient.unit}
                  onChangeText={(unit) => updateRow(index, { unit })}
                  placeholder={t(language as any, 'unit')}
                  placeholderTextColor={colors.textMuted}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => onChange(value.filter((_, idx) => idx !== index))}
                >
                  {t(language as any, 'delete')}
                </Button>
              </>
            ) : (
              <ThemedText>
                {ingredient.quantity ? `${ingredient.quantity} ` : ''}
                {ingredient.unit ? `${ingredient.unit} ` : ''}
                {ingredient.name}
              </ThemedText>
            )}
          </View>
        ))
      ) : (
        <ThemedText style={{ color: colors.textMuted }}>{t(language as any, 'noItems')}</ThemedText>
      )}

      {editing ? (
        <Button
          variant="outline"
          size="sm"
          onPress={() => onChange([...value, { name: '', quantity: '', unit: '' }])}
        >
          {t(language as any, 'addItem')}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    height: 40,
    borderWidth: 1,
    paddingHorizontal: 10,
  },
  name: {
    flex: 1,
    minWidth: 150,
  },
  compact: {
    width: 78,
  },
  errorText: {
    fontSize: 11,
  },
});
