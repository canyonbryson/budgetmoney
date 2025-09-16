import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
        }
        catch (err) {
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
            }
            else {
                console.error(JSON.stringify(completeSignUp, null, 2));
            }
        }
        catch (err) {
            console.error(JSON.stringify(err, null, 2));
        }
    };
    return (_jsx(View, { style: styles.authScreen, children: _jsxs(View, { style: styles.authForm, children: [!pendingVerification && (_jsxs(_Fragment, { children: [_jsxs(ThemedView, { style: { marginVertical: 16, alignItems: "center" }, children: [_jsx(ThemedText, { variant: "heading", children: "Create your account" }), _jsx(ThemedText, { variant: "default", children: "Welcome! Please fill in the details to get started." })] }), _jsx(View, { style: {
                                display: "flex",
                                flexDirection: "row",
                                gap: 8,
                            }, children: _jsx(View, { style: { flex: 1 }, children: _jsxs(OAuthButton, { strategy: "oauth_google", children: [_jsx(MaterialCommunityIcons, { name: "google", size: 18 }), " Google"] }) }) }), _jsxs(View, { style: { flexDirection: "row", alignItems: "center" }, children: [_jsx(View, { style: { flex: 1, height: 1, backgroundColor: "#eee" } }), _jsx(View, { children: _jsx(Text, { style: { width: 50, textAlign: "center" }, children: "or" }) }), _jsx(View, { style: { flex: 1, height: 1, backgroundColor: "#eee" } })] }), _jsx(Text, { children: "Email address" }), _jsx(TextInput, { style: styles.input, autoCapitalize: "none", value: emailAddress, onChangeText: (email) => setEmailAddress(email) }), _jsx(Text, { children: "Password" }), _jsx(TextInput, { style: styles.input, value: password, secureTextEntry: true, onChangeText: (password) => setPassword(password) }), _jsxs(ThemedButton, { onPress: onSignUpPress, children: [_jsx(Text, { children: "Continue" }), " ", _jsx(Ionicons, { name: "caret-forward" })] }), _jsxs(View, { style: {
                                display: "flex",
                                flexDirection: "row",
                                gap: 4,
                                justifyContent: "center",
                                marginVertical: 18,
                            }, children: [_jsx(Text, { children: "Already have an account?" }), _jsx(Link, { href: "/sign-in", children: _jsx(Text, { style: { fontWeight: "bold" }, children: "Sign in" }) })] })] })), pendingVerification && (_jsxs(_Fragment, { children: [_jsx(TextInput, { style: styles.input, value: code, placeholder: "Code...", onChangeText: (code) => setCode(code) }), _jsx(ThemedButton, { onPress: onPressVerify, children: "Verify code" })] }))] }) }));
}
