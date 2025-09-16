import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import * as SecureStore from "expo-secure-store";
import { i18n } from "@injured/i18n";
const DEFAULT_SETTINGS = {
    theme: "system",
    contrast: "default",
    reducedMotion: false,
    language: "en",
};
const THEME_KEY = "settings:theme";
const CONTRAST_KEY = "settings:contrast";
const REDUCED_MOTION_KEY = "settings:reducedMotion";
const LANGUAGE_KEY = "settings:language";
function normalizeToSupportedLang(l) {
    if (!l)
        return undefined;
    const lower = l.toLowerCase();
    if (lower.startsWith("es"))
        return "es";
    if (lower.startsWith("en"))
        return "en";
    if (lower === "zh" || lower.startsWith("zh-"))
        return "zh-CN";
    return undefined;
}
export const SettingsContext = React.createContext({
    ...DEFAULT_SETTINGS,
    setTheme: async () => { },
    setContrast: async () => { },
    setReducedMotion: async () => { },
    setLanguage: async () => { },
    isLoaded: false,
});
export function SettingsProvider({ children }) {
    const [theme, setThemeState] = React.useState(DEFAULT_SETTINGS.theme);
    const [language, setLanguageState] = React.useState(() => {
        const derived = normalizeToSupportedLang(i18n.language);
        return derived ?? DEFAULT_SETTINGS.language;
    });
    const [contrast, setContrastState] = React.useState(DEFAULT_SETTINGS.contrast);
    const [reducedMotion, setReducedMotionState] = React.useState(DEFAULT_SETTINGS.reducedMotion);
    const [isLoaded, setIsLoaded] = React.useState(false);
    React.useEffect(() => {
        (async () => {
            try {
                console.log("Getting stored theme, contrast, reducedMotion and language", THEME_KEY, CONTRAST_KEY, REDUCED_MOTION_KEY, LANGUAGE_KEY);
                const [storedTheme, storedContrast, storedReducedMotion, storedLanguage] = await Promise.all([
                    SecureStore.getItemAsync(THEME_KEY),
                    SecureStore.getItemAsync(CONTRAST_KEY),
                    SecureStore.getItemAsync(REDUCED_MOTION_KEY),
                    SecureStore.getItemAsync(LANGUAGE_KEY),
                ]);
                if (storedTheme === "system" ||
                    storedTheme === "light" ||
                    storedTheme === "dark") {
                    setThemeState(storedTheme);
                }
                if (storedContrast === "default" || storedContrast === "high") {
                    setContrastState(storedContrast);
                }
                if (storedReducedMotion === "true" || storedReducedMotion === "false") {
                    setReducedMotionState(storedReducedMotion === "true");
                }
                console.log("Stored language", storedLanguage);
                if (storedLanguage === "en" ||
                    storedLanguage === "es" ||
                    storedLanguage === "zh-CN" ||
                    storedLanguage === "zh-cn") {
                    // Normalize to proper case for consistency
                    setLanguageState(storedLanguage === "zh-cn" ? "zh-CN" : storedLanguage);
                }
                else {
                    // No stored language: derive from current i18n (device tag init)
                    const derived = normalizeToSupportedLang(i18n.language);
                    console.log("Derived language", derived);
                    if (derived) {
                        setLanguageState(derived);
                        try {
                            await SecureStore.setItemAsync(LANGUAGE_KEY, derived);
                            console.log("Stored language", derived);
                        }
                        catch { }
                    }
                }
            }
            finally {
                setIsLoaded(true);
            }
        })();
    }, []);
    const setTheme = React.useCallback(async (next) => {
        setThemeState(next);
        try {
            await SecureStore.setItemAsync(THEME_KEY, next);
        }
        catch { }
    }, []);
    const setLanguage = React.useCallback(async (next) => {
        setLanguageState(next);
        try {
            await SecureStore.setItemAsync(LANGUAGE_KEY, next);
        }
        catch { }
    }, []);
    const setContrast = React.useCallback(async (next) => {
        setContrastState(next);
        try {
            await SecureStore.setItemAsync(CONTRAST_KEY, next);
        }
        catch { }
    }, []);
    const setReducedMotion = React.useCallback(async (next) => {
        setReducedMotionState(next);
        try {
            await SecureStore.setItemAsync(REDUCED_MOTION_KEY, String(next));
        }
        catch { }
    }, []);
    // Keep i18next in sync with our stored language
    React.useEffect(() => {
        i18n.changeLanguage(language);
    }, [language]);
    const value = React.useMemo(() => ({
        theme,
        contrast,
        reducedMotion,
        language,
        setTheme,
        setContrast,
        setReducedMotion,
        setLanguage,
        isLoaded,
    }), [theme, contrast, reducedMotion, language, setTheme, setContrast, setReducedMotion, setLanguage, isLoaded]);
    return (_jsx(SettingsContext.Provider, { value: value, children: children }));
}
export function useSettings() {
    return React.useContext(SettingsContext);
}
