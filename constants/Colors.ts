/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Nativewind](https://nativewind.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { themes } from '@injured/ui/theme';
const tintColorLight = themes.light.colors.primary;
const tintColorDark = themes.dark.colors.primaryForeground;

export const Colors = {
  light: {
    text: themes.light.colors.foreground,
    background: themes.light.colors.background,
    tint: tintColorLight,
    icon: themes.light.colors.mutedForeground,
    tabIconDefault: themes.light.colors.mutedForeground,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: themes.dark.colors.foreground,
    background: themes.dark.colors.background,
    tint: tintColorDark,
    icon: themes.dark.colors.mutedForeground,
    tabIconDefault: themes.dark.colors.mutedForeground,
    tabIconSelected: tintColorDark,
  },
};
