import { i18n } from "@injured/i18n";
import * as SecureStore from "expo-secure-store";
import React from "react";

type ThemePreference = "system" | "light" | "dark";
type ContrastPreference = "default" | "high";
type ReducedMotionPreference = boolean;
type LanguageCode = "en" | "es" | "zh-CN";

type Settings = {
  theme: ThemePreference;
  contrast: ContrastPreference;
  reducedMotion: ReducedMotionPreference;
  language: LanguageCode;
};

type SettingsContextValue = Settings & {
  setTheme: (theme: ThemePreference) => Promise<void>;
  setContrast: (contrast: ContrastPreference) => Promise<void>;
  setReducedMotion: (reduced: ReducedMotionPreference) => Promise<void>;
  setLanguage: (language: LanguageCode) => Promise<void>;
  isLoaded: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  contrast: "default",
  reducedMotion: false,
  language: "en",
};

const THEME_KEY = "settings.theme";
const CONTRAST_KEY = "settings.contrast";
const REDUCED_MOTION_KEY = "settings.reducedMotion";
const LANGUAGE_KEY = "settings.language";

function normalizeToSupportedLang(l?: string): LanguageCode | undefined {
  if (!l) return undefined;
  const lower = l.toLowerCase();
  if (lower.startsWith("es")) return "es";
  if (lower.startsWith("en")) return "en";
  if (lower === "zh" || lower.startsWith("zh-")) return "zh-CN";
  return undefined;
}

export const SettingsContext = React.createContext<SettingsContextValue>({
  ...DEFAULT_SETTINGS,
  setTheme: async () => {},
  setContrast: async () => {},
  setReducedMotion: async () => {},
  setLanguage: async () => {},
  isLoaded: false,
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemePreference>(
    DEFAULT_SETTINGS.theme,
  );
  const [language, setLanguageState] = React.useState<LanguageCode>(() => {
    const derived = normalizeToSupportedLang(i18n.language);
    return derived ?? DEFAULT_SETTINGS.language;
  });
  const [contrast, setContrastState] = React.useState<ContrastPreference>(
    DEFAULT_SETTINGS.contrast,
  );
  const [reducedMotion, setReducedMotionState] =
    React.useState<ReducedMotionPreference>(DEFAULT_SETTINGS.reducedMotion);
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        console.log(
          "Getting stored theme, contrast, reducedMotion and language",
          THEME_KEY,
          CONTRAST_KEY,
          REDUCED_MOTION_KEY,
          LANGUAGE_KEY,
        );
        const [
          storedTheme,
          storedContrast,
          storedReducedMotion,
          storedLanguage,
        ] = await Promise.all([
          SecureStore.getItemAsync(THEME_KEY),
          SecureStore.getItemAsync(CONTRAST_KEY),
          SecureStore.getItemAsync(REDUCED_MOTION_KEY),
          SecureStore.getItemAsync(LANGUAGE_KEY),
        ]);
        if (
          storedTheme === "system" ||
          storedTheme === "light" ||
          storedTheme === "dark"
        ) {
          setThemeState(storedTheme);
        }
        if (storedContrast === "default" || storedContrast === "high") {
          setContrastState(storedContrast);
        }
        if (storedReducedMotion === "true" || storedReducedMotion === "false") {
          setReducedMotionState(storedReducedMotion === "true");
        }
        console.log("Stored language", storedLanguage);
        if (
          storedLanguage === "en" ||
          storedLanguage === "es" ||
          storedLanguage === "zh-CN" ||
          storedLanguage === "zh-cn"
        ) {
          // Normalize to proper case for consistency
          setLanguageState(
            storedLanguage === "zh-cn" ? "zh-CN" : storedLanguage,
          );
        } else {
          // No stored language: derive from current i18n (device tag init)
          const derived = normalizeToSupportedLang(i18n.language);
          console.log("Derived language", derived);
          if (derived) {
            setLanguageState(derived);
            try {
              await SecureStore.setItemAsync(LANGUAGE_KEY, derived);
              console.log("Stored language", derived);
            } catch {}
          }
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

  const setContrast = React.useCallback(async (next: ContrastPreference) => {
    setContrastState(next);
    try {
      await SecureStore.setItemAsync(CONTRAST_KEY, next);
    } catch {}
  }, []);

  const setReducedMotion = React.useCallback(
    async (next: ReducedMotionPreference) => {
      setReducedMotionState(next);
      try {
        await SecureStore.setItemAsync(REDUCED_MOTION_KEY, String(next));
      } catch {}
    },
    [],
  );

  // Keep i18next in sync with our stored language
  React.useEffect(() => {
    i18n.changeLanguage(language);
  }, [language]);

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      theme,
      contrast,
      reducedMotion,
      language,
      setTheme,
      setContrast,
      setReducedMotion,
      setLanguage,
      isLoaded,
    }),
    [
      theme,
      contrast,
      reducedMotion,
      language,
      setTheme,
      setContrast,
      setReducedMotion,
      setLanguage,
      isLoaded,
    ],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return React.useContext(SettingsContext);
}
