import type { PropsWithChildren } from 'react';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  type Edge,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';

type ScreenWrapperProps = PropsWithChildren<
  SafeAreaViewProps & {
    edges?: Edge[];
    style?: StyleProp<ViewStyle>;
  }
>;

export default function ScreenWrapper({
  children,
  edges = ['top'],
  style,
  ...otherProps
}: ScreenWrapperProps) {
  const { colors } = useAppTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: colors.background }, style]}
      {...otherProps}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
});
