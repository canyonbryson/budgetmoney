/**
 * Backward-compatible hook that resolves a color from the current app theme.
 * Prefer `useAppTheme().colors` directly in new code.
 */

import { useAppTheme } from '@/hooks/useAppTheme';
import type { ThemeColors } from '@/constants/themes/types';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors,
) {
  const theme = useAppTheme();
  const colorFromProps = props[theme.colorScheme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return theme.colors[colorName];
  }
}
