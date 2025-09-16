import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import * as WebBrowser from "expo-web-browser";
import { useSSO } from "@clerk/clerk-expo";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { ThemedButton } from "@injured/ui/ThemedButton";
WebBrowser.maybeCompleteAuthSession();
export default function OAuthButton({ strategy, children }) {
    React.useEffect(() => {
        if (Platform.OS !== "android")
            return;
        void WebBrowser.warmUpAsync();
        return () => {
            if (Platform.OS !== "android")
                return;
            void WebBrowser.coolDownAsync();
        };
    }, []);
    const { startSSOFlow } = useSSO();
    const onPress = React.useCallback(async () => {
        try {
            const { createdSessionId, setActive } = await startSSOFlow({
                strategy: strategy,
                // Redirect back to the root of the app after OAuth
                redirectUrl: Linking.createURL("/", { scheme: "injured" }),
            });
            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });
            }
        }
        catch (err) {
            console.error("OAuth error", err);
        }
    }, []);
    return _jsx(ThemedButton, { onPress: onPress, children: children });
}
