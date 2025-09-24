import { useUser, useAuth } from "@clerk/clerk-expo";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { api } from "@injured/backend/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Switch, Text, TextInput, View } from "react-native";

import Screen from "@/components/ui/Screen";
import { styles } from "@/constants/styles";

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { isSignedIn, sessionId } = useAuth();
  const externalId = user?.id;

  const userDoc = useQuery(
    api.auth.users.getUserByClerkUserId,
    externalId ? { externalId } : "skip",
  );

  const mfa = useQuery(
    api.auth.users.isMfaSatisfiedForSession,
    sessionId ? { clerkSessionId: sessionId } : "skip",
  );

  const ensureAppSession = useMutation(api.auth.users.ensureAppSession);
  const startPhoneVerification = useMutation(
    api.auth.users.startPhoneVerification,
  );
  const confirmPhoneVerification = useMutation(
    api.auth.users.confirmPhoneVerification,
  );
  const requestSmsSecondFactor = useMutation(
    api.auth.users.requestSmsSecondFactor,
  );
  const verifySmsSecondFactor = useMutation(
    api.auth.users.verifySmsSecondFactor,
  );

  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [rememberDevice, setRememberDevice] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Ensure a server-side app session row exists for this Clerk session
  React.useEffect(() => {
    if (!isSignedIn || !sessionId || !externalId) return;
    const deviceType = Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "OTHER";
    ensureAppSession({
      clerkSessionId: sessionId,
      externalId,
      device: { deviceType },
    }).catch(() => {});
  }, [isSignedIn, sessionId, externalId]);

  // If MFA satisfied, proceed to the app
  React.useEffect(() => {
    if (mfa && (mfa as any).satisfied) {
      router.replace("/");
    }
  }, [mfa]);

  if (!isSignedIn) {
    router.replace("/sign-in");
    return null;
  }

  const onEnrollSend = async () => {
    if (!userDoc?._id || !phone) return;
    setError(null);
    setSending(true);
    try {
      await startPhoneVerification({ userId: userDoc._id, phoneE164: phone });
    } catch (e: any) {
      setError(e?.message ?? "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const onEnrollVerify = async () => {
    if (!userDoc?._id || !phone || !code) return;
    setError(null);
    setVerifying(true);
    try {
      await confirmPhoneVerification({
        userId: userDoc._id,
        phoneE164: phone,
        code,
      });
      if (sessionId) {
        await requestSmsSecondFactor({ clerkSessionId: sessionId });
        setCode("");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to verify code");
    } finally {
      setVerifying(false);
    }
  };

  const onSessionSend = async () => {
    if (!sessionId) return;
    setError(null);
    setSending(true);
    try {
      await requestSmsSecondFactor({ clerkSessionId: sessionId });
    } catch (e: any) {
      setError(e?.message ?? "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const onSessionVerify = async () => {
    if (!sessionId || !code) return;
    setError(null);
    setVerifying(true);
    try {
      const deviceType = Platform.OS === "ios" ? "IOS" : Platform.OS === "android" ? "ANDROID" : "OTHER";
      await verifySmsSecondFactor({
        clerkSessionId: sessionId,
        code,
        rememberDevice,
        device: { deviceType },
      });
    } catch (e: any) {
      setError(e?.message ?? "Failed to verify code");
    } finally {
      setVerifying(false);
    }
  };

  const hasVerifiedPhone = Boolean(userDoc?.phoneNumberVerified && userDoc?.phoneE164);

  return (
    <Screen>
      <ThemedView style={{ flex: 1, padding: 16, gap: 12 }}>
        <ThemedText variant="heading">Verify your phone</ThemedText>
        {error && <ThemedText style={{ color: "red" }}>{error}</ThemedText>}

        {/* Enrollment flow */}
        {!hasVerifiedPhone && (
          <View style={{ gap: 12 }}>
            <ThemedText>Enter your phone number</ThemedText>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="+15551234567"
              value={phone}
              onChangeText={setPhone}
            />
            <ThemedButton disabled={sending || !phone} onPress={onEnrollSend}>
              Send code
            </ThemedButton>

            <ThemedText>Enter the code</ThemedText>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="123456"
              value={code}
              onChangeText={setCode}
            />
            <ThemedButton disabled={verifying || !code} onPress={onEnrollVerify}>
              Verify phone
            </ThemedButton>
          </View>
        )}

        {/* Per-session MFA flow */}
        {hasVerifiedPhone && (
          <View style={{ gap: 12 }}>
            <ThemedText>We need to verify this session</ThemedText>
            <ThemedButton disabled={sending} onPress={onSessionSend}>
              Send SMS code
            </ThemedButton>

            <ThemedText>Enter the code</ThemedText>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              placeholder="123456"
              value={code}
              onChangeText={setCode}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Switch value={rememberDevice} onValueChange={setRememberDevice} />
              <Text>Remember this device</Text>
            </View>

            <ThemedButton disabled={verifying || !code} onPress={onSessionVerify}>
              Verify session
            </ThemedButton>
          </View>
        )}
      </ThemedView>
    </Screen>
  );
}


