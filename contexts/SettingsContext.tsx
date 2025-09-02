import React from 'react';
import * as SecureStore from 'expo-secure-store';

type ThemePreference = 'system' | 'light' | 'dark';
type LanguageCode = 'en' | 'es' | 'zh-cn';

type Settings = {
  theme: ThemePreference;
  language: LanguageCode;
};

type SettingsContextValue = Settings & {
  setTheme: (theme: ThemePreference) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  isLoaded: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  language: 'en',
};

const THEME_KEY = 'settings:theme';
const LANGUAGE_KEY = 'settings:language';

export const SettingsContext = React.createContext<SettingsContextValue>({
  ...DEFAULT_SETTINGS,
  setTheme: async () => {},
  setLanguage: async () => {},
  isLoaded: false,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>(DEFAULT_SETTINGS.theme);
  const [language, setLanguageState] = React.useState<LanguageCode>(DEFAULT_SETTINGS.language);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [storedTheme, storedLanguage] = await Promise.all([
          SecureStore.getItemAsync(THEME_KEY),
          SecureStore.getItemAsync(LANGUAGE_KEY),
        ]);
        if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
          setThemeState(storedTheme);
        }
        if (storedLanguage === 'en' || storedLanguage === 'es' || storedLanguage === 'zh-cn') {
          setLanguageState(storedLanguage);
        }
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setTheme = React.useCallback(async (next: ThemePreference) => {
    setThemeState(next);
    try {
      await SecureStore.setItemAsync(THEME_KEY, next);
    } catch {}
  }, []);

  const setLanguage = React.useCallback(async (next: LanguageCode) => {
    setLanguageState(next);
    try {
      await SecureStore.setItemAsync(LANGUAGE_KEY, next);
    } catch {}
  }, []);

  const value = React.useMemo<SettingsContextValue>(() => ({
    theme,
    language,
    setTheme,
    setLanguage,
    isLoaded,
  }), [theme, language, setTheme, setLanguage, isLoaded]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return React.useContext(SettingsContext);
}


