import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { StyleSheet, TextInput } from "react-native";
import ParallaxScrollView from "@/components/ui/ParallaxScrollView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@injured/i18n";
import { useMutation, useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
export default function ProfileScreen() {
    const { t } = useTranslation();
    const { language } = useSettings();
    const { user } = useUser();
    const clerkUserId = user?.id;
    const userDoc = useQuery(api.auth.users.getUserByClerkUserId, clerkUserId ? { clerkUserId } : "skip");
    const [name, setName] = React.useState("");
    const [firstName, setFirstName] = React.useState("");
    const [lastName, setLastName] = React.useState("");
    const [bio, setBio] = React.useState("");
    const updateProfile = useMutation(api.auth.users.updateUserProfile);
    React.useEffect(() => {
        if (userDoc) {
            setName(userDoc.name ?? "");
        }
    }, [userDoc?.name]);
    if (!userDoc)
        return null;
    return (_jsx(ParallaxScrollView, { headerBackgroundColor: { light: "#D0D0D0", dark: "#353636" }, headerImage: _jsx(Ionicons, { size: 310, name: "people", style: styles.headerImage }), children: _jsxs(ThemedView, { style: styles.container, children: [_jsx(ThemedText, { variant: "heading", children: t("settings") }), _jsx(ThemedText, { variant: "subheading", children: "Profile" }), _jsx(ThemedText, { variant: "default", children: "Name" }), _jsx(TextInput, { style: styles.input, value: name, onChangeText: setName }), _jsx(ThemedText, { variant: "default", children: "First name" }), _jsx(TextInput, { style: styles.input, value: firstName, onChangeText: setFirstName }), _jsx(ThemedText, { variant: "default", children: "Last name" }), _jsx(TextInput, { style: styles.input, value: lastName, onChangeText: setLastName }), _jsx(ThemedText, { variant: "default", children: "Bio" }), _jsx(TextInput, { style: [styles.input, { height: 80 }], multiline: true, value: bio, onChangeText: setBio }), _jsx(ThemedButton, { onPress: async () => {
                        await updateProfile({
                            userId: userDoc._id,
                            name,
                            firstName,
                            lastName,
                            bio,
                        });
                    }, children: "Save" })] }) }));
}
const styles = StyleSheet.create({
    container: {
        gap: 12,
        padding: 12,
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 10,
        borderColor: "rgba(0,0,0,0.11)",
    },
    headerImage: {
        marginBottom: 0,
    },
});
