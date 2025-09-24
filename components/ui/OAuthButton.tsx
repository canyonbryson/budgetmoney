import { useSSO } from "@clerk/clerk-expo";
import { ThemedButton } from "@injured/ui/ThemedButton";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import { Platform } from "react-native";

type Props = {
  strategy: string;
  children: React.ReactNode;
};

WebBrowser.maybeCompleteAuthSession();

export default function OAuthButton({ strategy, children }: Props) {
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

  return <ThemedButton onPress={onPress}>{children}</ThemedButton>;
}
