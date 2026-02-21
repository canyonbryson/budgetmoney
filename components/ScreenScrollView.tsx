import type { PropsWithChildren } from 'react';
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
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
  edges = [],
  style,
  contentContainerStyle,
  ...otherProps
}: ScreenScrollViewProps) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const extraBottomPadding = height * 0.2;
  const combinedContentStyle = StyleSheet.flatten([styles.content, contentContainerStyle]) as
    | ViewStyle
    | undefined;
  const { flex, paddingBottom, ...contentWithoutFlex } = combinedContentStyle ?? {};
  const contentPaddingBottom =
    (typeof paddingBottom === 'number' ? paddingBottom : 0) + extraBottomPadding;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.container, { backgroundColor: colors.background }, style]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingContainer}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={styles.scroll}
          contentContainerStyle={[
            contentWithoutFlex,
            {
              paddingBottom: contentPaddingBottom,
            },
          ]}
          {...otherProps}
        >
          {children}
        </ScrollView>
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
  content: {
    flexGrow: 1,
  },
  scroll: {
    flex: 1,
  },
});
