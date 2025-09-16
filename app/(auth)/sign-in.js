import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { Text, View, ActivityIndicator, TextInput } from "react-native";
import React from "react";
import { ThemedButton } from "@injured/ui/ThemedButton";
import OAuthButton from "@/components/ui/OAuthButton";
import MaterialCommunityIcons from "@expo/vector-icons/build/MaterialCommunityIcons";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { styles } from "@/constants/styles";
import { Ionicons } from "@expo/vector-icons";
export default function SignInScreen() {
    const { signIn, setActive, isLoaded } = useSignIn();
    const router = useRouter();
    const [emailAddress, setEmailAddress] = React.useState("");
    const [password, setPassword] = React.useState("");
    const onSignInPress = React.useCallback(async () => {
        if (!isLoaded) {
            return;
        }
        try {
            const signInAttempt = await signIn.create({
                identifier: emailAddress,
                password,
            });
            if (signInAttempt.status === "complete") {
                await setActive({
                    session: signInAttempt.createdSessionId,
                });
                router.replace("/");
            }
            else {
                console.error(JSON.stringify(signInAttempt, null, 2));
            }
        }
        catch (err) {
            console.error(JSON.stringify(err, null, 2));
        }
    }, [isLoaded, emailAddress, password]);
    if (!isLoaded) {
        return _jsx(ActivityIndicator, { size: "large" });
    }
    return (_jsx(View, { style: styles.authScreen, children: _jsxs(View, { style: styles.authForm, children: [_jsxs(ThemedView, { style: { marginVertical: 16, alignItems: "center" }, children: [_jsx(ThemedText, { variant: "heading", children: "Sign into Injured" }), _jsx(ThemedText, { variant: "default", children: "Welcome back! Please sign in to continue" })] }), _jsx(View, { style: {
                        display: "flex",
                        flexDirection: "row",
                        gap: 8,
                    }, children: _jsx(View, { style: { flex: 1 }, children: _jsxs(OAuthButton, { strategy: "oauth_google", children: [_jsx(MaterialCommunityIcons, { name: "google", size: 18 }), " Google"] }) }) }), _jsxs(View, { style: { flexDirection: "row", alignItems: "center" }, children: [_jsx(View, { style: { flex: 1, height: 1, backgroundColor: "#eee" } }), _jsx(View, { children: _jsx(Text, { style: { width: 50, textAlign: "center", color: "#555" }, children: "or" }) }), _jsx(View, { style: { flex: 1, height: 1, backgroundColor: "#eee" } })] }), _jsxs(View, { style: { gap: 8, marginBottom: 24 }, children: [_jsx(Text, { children: "Email address" }), _jsx(TextInput, { style: styles.input, autoCapitalize: "none", value: emailAddress, onChangeText: (emailAddress) => setEmailAddress(emailAddress) }), _jsx(Text, { children: "Password" }), _jsx(TextInput, { style: styles.input, value: password, secureTextEntry: true, onChangeText: (password) => setPassword(password) })] }), _jsxs(ThemedButton, { onPress: onSignInPress, children: [_jsx(Text, { children: "Sign in" }), " ", _jsx(Ionicons, { name: "caret-forward" })] }), _jsxs(View, { style: {
                        display: "flex",
                        flexDirection: "row",
                        gap: 4,
                        justifyContent: "center",
                        marginVertical: 18,
                    }, children: [_jsx(Text, { children: "Don't have an account?" }), _jsx(Link, { href: "/sign-up", children: _jsx(Text, { style: { fontWeight: "bold" }, children: "Sign up" }) })] })] }) }));
}
