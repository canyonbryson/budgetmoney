import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Href } from "expo-router";
import React from "react";
import { get as getLanding } from "@/src/lib/devicePrefs";

function AuthedRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  const [hasSeenLanding, setHasSeenLanding] = React.useState<boolean | null>(
    null,
  );
  React.useEffect(() => {
    getLanding().then(setHasSeenLanding).catch(() => setHasSeenLanding(false));
  }, []);
  if (!isLoaded || hasSeenLanding === null) return null;
  if (!hasSeenLanding) return <Redirect href={"/(marketing)/loading" as Href} />;
  return (
    <Redirect href={(isSignedIn ? "/(tabs)" : "/(auth)/sign-in") as Href} />
  );
}

export default function Index() {
  const hasClerk = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
  if (!hasClerk) {
    return <Redirect href={"/(auth)/sign-in" as Href} />;
  }
  return <AuthedRedirect />;
}
