/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */
import { useColorScheme } from "react-native";
import { Colors } from "@/constants/Colors";
import { useSettings } from "@/contexts/SettingsContext";
export function useThemeColor(props, colorName) {
    const systemScheme = useColorScheme() ?? "light";
    const { theme } = useSettings();
    const effectiveScheme = theme === "system" ? systemScheme : theme;
    const colorFromProps = props[effectiveScheme];
    if (colorFromProps) {
        return colorFromProps;
    }
    else {
        return Colors[effectiveScheme][colorName];
    }
}
