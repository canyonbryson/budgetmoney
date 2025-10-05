import { useSignIn } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { Branding, Icons, PasswordInput, ThemedScreen, useThemeContext } from "@injured/ui";
import { FormInput } from "@injured/ui";
import { Link, useRouter } from "expo-router";
import React from "react";
import { View, ActivityIndicator, Platform, KeyboardAvoidingView } from "react-native";

import OAuthButton from "@/components/ui/OAuthButton";
import { styles } from "@/constants/styles";
import { useTranslation } from "@injured/i18n";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme } = useThemeContext();

  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [password, setPassword] = React.useState("");

  const onSignInPress = React.useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const signInAttempt = await signIn.create({
        identifier: phoneNumber,
        password,
      });

      if (signInAttempt.status === "complete") {
        await setActive({
          session: signInAttempt.createdSessionId,
        });

        router.replace("/verify-phone");
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2));
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [isLoaded, phoneNumber, password]);

  if (!isLoaded) {
    return <ActivityIndicator size="large" />;
  }

  const footer = (
    <View
      style={{
        display: "flex",
        justifyContent: "center",
        flex: 1,
        flexDirection: "row",
        gap: 4,
      }}
    >
      <Link href="/(registration)/account-creation">
        <ThemedText i18nKey="newUser" />
        &nbsp;&nbsp;
        <ThemedText style={{ color: theme.colors.primary }} i18nKey="createAccount" />
      </Link>
    </View>
  );

  return (
    <ThemedScreen scroll={false} footer={footer}>
      <View style={styles.authForm}>
        {/* Branding */}
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Branding.logoIcon color={theme.colors.primary} width={85} height={138} />
        </View>

        {/* Header text */}
        <View style={{ marginVertical: 20, alignItems: "center", gap: 10 }}>
          <ThemedText variant="heading" style={{ textAlign: "center", fontSize: 40, paddingTop: 4 }} i18nKey="signInTitle" />
          <ThemedText variant="default" style={{ textAlign: "center" }} i18nKey="signInSubtitle" />
        </View>

        {/* Inputs */}
        <View style={{ gap: 20, marginBottom: 30 }}>
          <FormInput
            i18nLabelKey="phoneNumber"
            placeholder="Phone Number"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            textContentType={Platform.OS === "ios" ? "telephoneNumber" : undefined}
            autoCapitalize="none"
            fullWidth
          />
          <PasswordInput
            i18nLabelKey="password"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            textContentType={Platform.OS === "ios" ? "password" : undefined}
            autoCapitalize="none"
            fullWidth
          />
        </View>

        {/* Primary CTA */}
        <ThemedButton onPress={onSignInPress} size="lg" fullWidth i18nKey="login" />

        <View style={{ marginVertical: 20 }}/>
        

        {/* OAuth buttons */}
        <View style={{ display: "flex", flexDirection: "row", justifyContent: "center", width: "100%", gap: 30 }}>
          <View>
            <OAuthButton strategy="oauth_google">
              <Icons.google size={28} color={theme.colors.iconSecondary} /> 
            </OAuthButton>
          </View>
          <View>
            <OAuthButton strategy="oauth_apple">
              <Ionicons name="logo-apple" size={28} color={theme.colors.iconSecondary} /> 
            </OAuthButton>
          </View>
        </View>

      </View>
    </ThemedScreen>
  );
}
