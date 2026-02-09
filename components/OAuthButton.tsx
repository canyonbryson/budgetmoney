import React from "react";
import * as WebBrowser from "expo-web-browser";
import { useOAuth } from "@clerk/clerk-expo";
import type { OAuthStrategy } from "@clerk/types";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import Button from "./Button";

type Props = {
  strategy: OAuthStrategy;
  children: React.ReactNode;
};

WebBrowser.maybeCompleteAuthSession();

export default function OAuthButton({ strategy, children }: Props) {
  const { startOAuthFlow } = useOAuth({ strategy });

  React.useEffect(() => {
    if (Platform.OS !== "android") return;

    void WebBrowser.warmUpAsync();
    return () => {
      if (Platform.OS !== "android") return;

      void WebBrowser.coolDownAsync();
    };
  }, []);

  const onPress = React.useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startOAuthFlow({
        // Redirect back to the root of the app after OAuth
        redirectUrl: Linking.createURL("/", { scheme: "grocerybudget" }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error("OAuth error", err);
    }
  }, [startOAuthFlow]);

  return (
    <Button onPress={onPress}>
      { children }
    </Button>
  );
}
