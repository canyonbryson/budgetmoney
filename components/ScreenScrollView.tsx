import type { PropsWithChildren } from 'react';
import React from 'react';
import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  type Edge,
  type SafeAreaViewProps,
} from 'react-native-safe-area-context';

import { useAppTheme } from '@/hooks/useAppTheme';

type ScreenScrollViewProps = PropsWithChildren<
  SafeAreaViewProps & {
    edges?: Edge[];
    style?: StyleProp<ViewStyle>;
    contentContainerStyle?: StyleProp<ViewStyle>;
  }
>;

export default function ScreenScrollView({
  children,
  edges = ['top'],
  style,
  contentContainerStyle,
  ...otherProps
}: ScreenScrollViewProps) {
  const { colors } = useAppTheme();
  const combinedContentStyle = StyleSheet.flatten([styles.content, contentContainerStyle]) as
    | ViewStyle
    | undefined;
  const { flex, ...contentWithoutFlex } = combinedContentStyle ?? {};

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.scroll}
        contentContainerStyle={contentWithoutFlex}
        {...otherProps}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  scroll: {
    flex: 1,
  },
});
