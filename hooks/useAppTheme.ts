import React from 'react';
import { ThemeContext } from '@/contexts/ThemeContext';
import type { ResolvedTheme } from '@/constants/themes';

export function useAppTheme(): ResolvedTheme {
  return React.useContext(ThemeContext);
}
