import React from 'react';
import type { ResolvedTheme } from '@/constants/themes';
import { resolveTheme, DEFAULT_THEME_ID } from '@/constants/themes';

const defaultResolved = resolveTheme(DEFAULT_THEME_ID, 'light');

export const ThemeContext = React.createContext<ResolvedTheme>(defaultResolved);

export function ThemeProvider({
  children,
  theme,
}: {
  children: React.ReactNode;
  theme: ResolvedTheme;
}) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}
