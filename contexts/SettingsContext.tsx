import React from 'react';
import type { ThemeId } from '@/constants/themes';
import { DEFAULT_THEME_ID, themeIds } from '@/constants/themes';
import { secureGetItem, secureSetItem } from '@/lib/secureStore';

type ThemePreference = 'system' | 'light' | 'dark';
type LanguageCode = 'en' | 'es' | 'zh-cn';

type Settings = {
  theme: ThemePreference;
  brandTheme: ThemeId;
  language: LanguageCode;
};

type SettingsContextValue = Settings & {
  setTheme: (theme: ThemePreference) => Promise<void>;
  setBrandTheme: (brandTheme: ThemeId) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  isLoaded: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  brandTheme: DEFAULT_THEME_ID,
  language: 'en',
};

const THEME_KEY = 'settings.theme';
const BRAND_THEME_KEY = 'settings.brandTheme';
const LANGUAGE_KEY = 'settings.language';

export const SettingsContext = React.createContext<SettingsContextValue>({
  ...DEFAULT_SETTINGS,
  setTheme: async () => {},
  setBrandTheme: async () => {},
  setLanguage: async () => {},
  isLoaded: false,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>(DEFAULT_SETTINGS.theme);
  const [brandTheme, setBrandThemeState] = React.useState<ThemeId>(DEFAULT_SETTINGS.brandTheme);
  const [language, setLanguageState] = React.useState<LanguageCode>(DEFAULT_SETTINGS.language);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const [storedTheme, storedBrandTheme, storedLanguage] = await Promise.all([
          secureGetItem(THEME_KEY),
          secureGetItem(BRAND_THEME_KEY),
          secureGetItem(LANGUAGE_KEY),
        ]);
        if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
          setThemeState(storedTheme);
        }
        if (storedBrandTheme && (themeIds as string[]).includes(storedBrandTheme)) {
          setBrandThemeState(storedBrandTheme as ThemeId);
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
      await secureSetItem(THEME_KEY, next);
    } catch {}
  }, []);

  const setBrandTheme = React.useCallback(async (next: ThemeId) => {
    setBrandThemeState(next);
    try {
      await secureSetItem(BRAND_THEME_KEY, next);
    } catch {}
  }, []);

  const setLanguage = React.useCallback(async (next: LanguageCode) => {
    setLanguageState(next);
    try {
      await secureSetItem(LANGUAGE_KEY, next);
    } catch {}
  }, []);

  const value = React.useMemo<SettingsContextValue>(() => ({
    theme,
    brandTheme,
    language,
    setTheme,
    setBrandTheme,
    setLanguage,
    isLoaded,
  }), [theme, brandTheme, language, setTheme, setBrandTheme, setLanguage, isLoaded]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return React.useContext(SettingsContext);
}
