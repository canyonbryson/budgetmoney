import React from 'react'
import { StyleProp, TouchableOpacity, ViewStyle, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/hooks/useAppTheme';

type Props = {
  onPress: () => void
  children: React.ReactNode | string,
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  variant?: 'primary' | 'secondary' | 'outline' | 'accent' | 'ghost'
  size?: 'sm' | 'md'
}

function Button({ onPress, children, disabled, style, variant = 'primary', size = 'md' }: Props) {
  const { colors, borderRadius, typography, shadows, spacing } = useAppTheme();

  const bg = (() => {
    switch (variant) {
      case 'secondary': return colors.primaryMuted;
      case 'accent': return colors.accent;
      case 'outline': return 'transparent';
      case 'ghost': return 'transparent';
      default: return colors.primary;
    }
  })();

  const border = (() => {
    switch (variant) {
      case 'secondary': return colors.primary;
      case 'accent': return colors.accent;
      case 'outline': return colors.border;
      case 'ghost': return 'transparent';
      default: return colors.primary;
    }
  })();

  const textColor = (() => {
    switch (variant) {
      case 'secondary': return colors.primary;
      case 'accent': return colors.textOnPrimary;
      case 'outline': return colors.text;
      case 'ghost': return colors.primary;
      default: return colors.textOnPrimary;
    }
  })();

  const paddingV = size === 'sm' ? spacing.xs + 2 : spacing.sm + 2;
  const paddingH = size === 'sm' ? spacing.md : spacing.lg;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderColor: border,
          borderRadius: borderRadius.md,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          ...(variant !== 'ghost' ? shadows.sm : {}),
        },
        disabled ? styles.disabled : null,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[
        styles.text,
        {
          color: textColor,
          fontFamily: typography.bodySemiBold.fontFamily,
          fontWeight: typography.bodySemiBold.fontWeight,
          fontSize: size === 'sm' ? 13 : typography.bodySemiBold.fontSize,
        },
      ]}>
        { children }
      </Text>
    </TouchableOpacity>
  )
}

export default Button

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    display: "flex",
    gap: 2,
    justifyContent: "center",
    alignContent: "center",
    alignItems: "center",
  }
});
