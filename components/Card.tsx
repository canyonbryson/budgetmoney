import React from 'react';
import { View, type ViewProps, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

export type CardProps = ViewProps & {
  variant?: 'default' | 'elevated' | 'accent' | 'muted';
  noPadding?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function Card({
  children,
  variant = 'default',
  noPadding,
  style,
  ...rest
}: CardProps) {
  const { colors, borderRadius, spacing, shadows } = useAppTheme();

  const bg = (() => {
    switch (variant) {
      case 'elevated':
        return colors.backgroundElevated;
      case 'accent':
        return colors.accentMuted;
      case 'muted':
        return colors.primaryMuted;
      default:
        return colors.backgroundCard;
    }
  })();

  const borderColor = (() => {
    switch (variant) {
      case 'accent':
        return colors.accent;
      case 'muted':
        return colors.primary;
      default:
        return colors.borderLight;
    }
  })();

  const shadow = variant === 'elevated' ? shadows.md : shadows.sm;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor,
          borderRadius: borderRadius.lg,
          padding: noPadding ? 0 : spacing.lg,
          ...shadow,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
