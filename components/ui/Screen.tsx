import React from 'react';
import { StyleSheet, ViewProps } from 'react-native';
import { ThemedView } from '@/components/ui/ThemedView';
import { ThemedText } from '@/components/ui/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = ViewProps & {
  title?: string;
  showTitle?: boolean;
  right?: React.ReactNode;
  left?: React.ReactNode;
  children: React.ReactNode;
};

export default function Screen({ 
  title, 
  showTitle = false, 
  right, 
  left, 
  style, 
  children, 
  ...rest 
}: Props) {
  const insets = useSafeAreaInsets();
  
  return (
    <ThemedView style={[styles.container, style]} {...rest}>
      <ThemedView style={[styles.content, { paddingTop: insets.top + 16 }]}>
        {showTitle && title && (
          <ThemedView style={styles.header}>
            {left}
            <ThemedText type="title" style={styles.title}>{title}</ThemedText>
            {right}
          </ThemedView>
        )}
        {children}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});


