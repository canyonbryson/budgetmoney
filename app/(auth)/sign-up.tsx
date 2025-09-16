import React from "react";
import { View, Text } from "react-native";
import { useSignUp } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { styles } from "@/constants/styles";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import OAuthButton from "@/components/ui/OAuthButton";
import { TextInput } from "react-native";

export default function SignUpScreen() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [code, setCode] = React.useState("");

  const onSignUpPress = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      await signUp.create({
        emailAddress,
        password,
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setPendingVerification(true);
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  const onPressVerify = async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.replace("/");
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2));
    }
  };

  return (
    <View style={styles.authScreen}>
      <View style={styles.authForm}>
        {!pendingVerification && (
          <>
            <ThemedView style={{ marginVertical: 16, alignItems: "center" }}>
              <ThemedText variant="heading">Create your account</ThemedText>
              <ThemedText variant="default">
                Welcome! Please fill in the details to get started.
              </ThemedText>
            </ThemedView>

            <View
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                <OAuthButton strategy="oauth_google">
                  <MaterialCommunityIcons name="google" size={18} /> Google
                </OAuthButton>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#eee" }} />
              <View>
                <Text style={{ width: 50, textAlign: "center" }}>or</Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: "#eee" }} />
            </View>

            <Text>Email address</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              value={emailAddress}
              onChangeText={(email) => setEmailAddress(email)}
            />
            <Text>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              secureTextEntry={true}
              onChangeText={(password) => setPassword(password)}
            />
            <ThemedButton onPress={onSignUpPress}>
              <Text>Continue</Text> <Ionicons name="caret-forward" />
            </ThemedButton>

            <View
              style={{
                display: "flex",
                flexDirection: "row",
                gap: 4,
                justifyContent: "center",
                marginVertical: 18,
              }}
            >
              <Text>Already have an account?</Text>
              <Link href="/sign-in">
                <Text style={{ fontWeight: "bold" }}>Sign in</Text>
              </Link>
            </View>
          </>
        )}

        {/* If the user has submitted credentials, render a verification form instead */}
        {pendingVerification && (
          <>
            <TextInput
              style={styles.input}
              value={code}
              placeholder="Code..."
              onChangeText={(code) => setCode(code)}
            />
            <ThemedButton onPress={onPressVerify}>Verify code</ThemedButton>
          </>
        )}
      </View>
    </View>
  );
}
