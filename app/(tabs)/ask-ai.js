import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, View, ActivityIndicator, useColorScheme, } from "react-native";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import Screen from "@/components/ui/Screen";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useSettings } from "@/contexts/SettingsContext";
import { useTranslation } from "@injured/i18n";
import { useAction } from "convex/react";
// Theme is provided via UI ThemeProvider; avoid direct theme import here
import { api } from "@injured/backend/convex/_generated/api";
import { ThemedInput as ThemedInputRN } from "@injured/ui";
const Input = ThemedInputRN;
export default function AskAiScreen() {
    const { t } = useTranslation();
    const { language, theme } = useSettings();
    const [messages, setMessages] = React.useState([]);
    const [input, setInput] = React.useState("");
    const [loading, setLoading] = React.useState(false);
    const ask = useAction(api.ask_ai.ask);
    const system = useColorScheme() ?? "light";
    const effective = theme === "system" ? system : theme;
    const palette = {
        muted: "#f2f2f2",
        card: "#ffffff",
        border: "#e5e5e5",
    };
    const onSend = React.useCallback(async () => {
        if (!input.trim())
            return;
        const userMessage = {
            id: String(Date.now()),
            role: "user",
            content: input.trim(),
        };
        setMessages((prev) => [userMessage, ...prev]);
        setInput("");
        try {
            setLoading(true);
            const content = await ask({ prompt: userMessage.content });
            const reply = {
                id: String(Date.now() + 1),
                role: "assistant",
                content: content || "",
            };
            setMessages((prev) => [reply, ...prev]);
        }
        catch (e) {
            const reply = {
                id: String(Date.now() + 1),
                role: "assistant",
                content: "Sorry, something went wrong.",
            };
            setMessages((prev) => [reply, ...prev]);
        }
        finally {
            setLoading(false);
        }
    }, [input, ask]);
    return (_jsx(KeyboardAvoidingView, { style: { flex: 1 }, behavior: Platform.select({ ios: "padding", android: undefined }), children: _jsxs(Screen, { children: [_jsx(ThemedText, { variant: "heading", style: styles.screenTitle, children: t("askAi") }), _jsxs(View, { style: styles.inputRow, children: [_jsx(Input, { placeholder: t("promptPlaceholder"), value: input, onChange: (e) => setInput(e?.target?.value ?? e?.nativeEvent?.text ?? ""), style: { width: "100%", flex: 1 } }), _jsx(ThemedButton, { onPress: onSend, disabled: loading, children: t("send") })] }), _jsxs(View, { style: styles.messages, children: [loading && _jsx(ActivityIndicator, { size: "small" }), messages.map((m) => {
                            const bubbleStyle = {
                                padding: 16,
                                borderRadius: 12,
                                backgroundColor: m.role === "assistant" ? palette.muted : palette.card,
                                borderColor: palette.border,
                                borderWidth: StyleSheet.hairlineWidth,
                            };
                            return (_jsx(ThemedView, { style: bubbleStyle, children: _jsx(ThemedText, { children: m.content }) }, m.id));
                        })] })] }) }));
}
const styles = StyleSheet.create({
    screenTitle: {
        fontSize: 28,
        fontWeight: "700",
        marginBottom: 20,
    },
    inputRow: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        marginBottom: 16,
    },
    messages: {
        flex: 1,
        gap: 12,
    },
});
