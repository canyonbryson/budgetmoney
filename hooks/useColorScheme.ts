import { useColorScheme as useRNColorScheme } from 'react-native';

import { useSettings } from '@/contexts/SettingsContext';

export function useColorScheme() {
  const systemScheme = useRNColorScheme();
  const { theme, isLoaded } = useSettings();

  if (!isLoaded || theme === 'system') {
    return systemScheme;
  }

  return theme;
}
