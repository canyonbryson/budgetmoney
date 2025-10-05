import { useSSO } from "@clerk/clerk-expo";
import { useThemeContext } from "@injured/ui/src/theme-context";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Platform, Pressable } from "react-native";

type Props = {
  strategy: string;
  children: React.ReactNode;
};

WebBrowser.maybeCompleteAuthSession();

export default function OAuthButton({ strategy, children }: Props) {
  const { theme } = useThemeContext();

  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    void WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") return;

      void WebBrowser.coolDownAsync();
    };
  }, []);

  const { startSSOFlow } = useSSO();

  const onPress = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: strategy as any,
        // Redirect back to the root of the app after OAuth
        redirectUrl: Linking.createURL("/", { scheme: "injured" }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error("OAuth error", err);
    }
  }, []);

  return <Pressable style={{ borderWidth: 2, borderColor: theme.colors.actionSecondaryBorder, width: 50, height: 50, justifyContent: "center", alignItems: "center", borderRadius: 14 }} onPress={onPress}>{children}</Pressable>;
}
