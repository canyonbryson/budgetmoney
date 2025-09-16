import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StyleSheet, View } from "react-native";
import { MotiView } from "moti";
import Screen from "@/components/ui/Screen";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { ThemedText } from "@injured/ui/ThemedText";
import { useTranslation } from "@injured/i18n";
import { useSettings } from "@/contexts/SettingsContext";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
const Probe = () => {
    const x = useSharedValue(0);
    useEffect(() => {
        x.value = withTiming(50, { duration: 300 });
    }, []);
    const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
    return _jsx(Animated.View, { style: [{ width: 20, height: 20, backgroundColor: 'cyan' }, style] });
};
// Inside your screen JSX:
export default function HomeScreen() {
    const { language } = useSettings();
    const { t } = useTranslation();
    const { user } = useUser();
    const { signOut } = useAuth();
    const onSignOutPress = async () => {
        try {
            await signOut({ redirectUrl: "/" });
        }
        catch { }
    };
    return (_jsx(Screen, { children: _jsxs(ThemedView, { style: styles.stepContainer, children: [_jsx(ThemedText, { variant: "heading", style: styles.welcomeTitle, children: t("welcome") }), _jsxs(View, { style: styles.userInfo, children: [_jsxs(ThemedText, { style: styles.signedInText, children: [t("signedInAs"), ": ", user?.emailAddresses?.[0]?.emailAddress] }), _jsx(ThemedButton, { onPress: onSignOutPress, children: t("signOut") })] }), _jsx(Probe, {}), _jsx(MotiView, { from: { opacity: 0, translateY: 12 }, animate: { opacity: 1, translateY: 0 }, transition: { type: "timing", duration: 600 }, style: { width: 80, height: 80, backgroundColor: 'tomato', borderRadius: 8 }, children: _jsx(ThemedText, { children: "Hello" }) })] }) }));
}
const styles = StyleSheet.create({
    titleContainer: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    stepContainer: {
        gap: 24,
        paddingTop: 20,
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 8,
    },
    userInfo: {
        gap: 16,
        padding: 20,
        borderRadius: 12,
        backgroundColor: "rgba(0,0,0,0.02)",
    },
    signedInText: {
        fontSize: 16,
        opacity: 0.8,
    },
    reactLogo: {
        height: 178,
        width: 290,
        bottom: 0,
        left: 0,
        position: "absolute",
    },
});
