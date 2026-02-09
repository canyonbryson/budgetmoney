import { Text, type TextProps, StyleSheet } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
};

export function ThemedText({
  style,
  type = 'default',
  ...rest
}: ThemedTextProps) {
  const { colors, typography } = useAppTheme();

  const typeStyle = (() => {
    switch (type) {
      case 'title': return typography.title;
      case 'subtitle': return typography.subtitle;
      case 'defaultSemiBold': return typography.bodySemiBold;
      case 'link': return { ...typography.link, color: colors.primary };
      default: return typography.body;
    }
  })();

  return (
    <Text
      style={[
        { color: colors.text },
        typeStyle,
        style,
      ]}
      {...rest}
    />
  );
}
