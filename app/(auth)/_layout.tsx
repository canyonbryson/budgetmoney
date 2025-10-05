import { useAuth } from "@clerk/clerk-expo";
import React from "react";
import SignInScreen from "./sign-in";
import { Href, Redirect } from "expo-router";

export default function AuthRoutesLayout() {
  const { isSignedIn } = useAuth();

  if (isSignedIn) {
    return <Redirect href={"/(tabs)" as Href} />;
  }

  return (
      <SignInScreen />
  );
}
