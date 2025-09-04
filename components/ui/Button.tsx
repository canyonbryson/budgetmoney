import React from 'react'
import { StyleProp, TouchableOpacity, ViewStyle, StyleSheet, Text } from 'react-native';
import { themes } from '@injured/ui/theme';
import { useColorScheme } from 'react-native';
import { useSettings } from '@/contexts/SettingsContext';

type Props = {
  onPress: () => void
  children: React.ReactNode | string,
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

function Button({ onPress, children, disabled }: Props) {
  const system = useColorScheme() ?? 'light';
  const { theme } = useSettings();
  const effective = theme === 'system' ? system : theme;
  const palette = effective === 'dark' ? themes.dark.colors : themes.light.colors;
  return (
    <TouchableOpacity
      style={!disabled ? [styles.button, { backgroundColor: palette.primary, borderColor: palette.ring }] : {
        ...styles.button,
        ...styles.disabled
      }}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.text, { color: palette.primaryForeground }]}>
        { children }
      </Text>
    </TouchableOpacity>
  )
}

export default Button

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "rgb(47, 48, 55)",
    borderColor: "rgb(47, 48, 55)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(0, 0, 0, 0.1)",
    shadowOffset: {
      height: 2,
      width: 0
    },
    shadowRadius: 4,
    shadowOpacity: 1,
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
    lineHeight: 20,
  }
});