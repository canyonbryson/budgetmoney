import { View, type ViewProps } from 'react-native';

import { useAppTheme } from '@/hooks/useAppTheme';

export type ThemedViewProps = ViewProps & {
  variant?: 'default' | 'card' | 'elevated';
};

export function ThemedView({ style, variant = 'default', ...otherProps }: ThemedViewProps) {
  const { colors } = useAppTheme();

  const bg = (() => {
    switch (variant) {
      case 'card': return colors.backgroundCard;
      case 'elevated': return colors.backgroundElevated;
      default: return colors.background;
    }
  })();

  return <View style={[{ backgroundColor: bg }, style]} {...otherProps} />;
}
