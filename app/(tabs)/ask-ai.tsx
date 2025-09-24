import { api } from "@injured/backend/convex/_generated/api";
import { useTranslation } from "@injured/i18n";
import { ThemedInput as ThemedInputRN } from "@injured/ui";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useAction } from "convex/react";
import React from "react";
import type ReactNamespace from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  ActivityIndicator,
  useColorScheme,
} from "react-native";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

// Theme is provided via UI ThemeProvider; avoid direct theme import here
const Input = ThemedInputRN as unknown as ReactNamespace.ComponentType<any>;

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function AskAiScreen() {
  const { t } = useTranslation();
  const { language, theme } = useSettings();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const ask = useAction(api.ask_ai.ask);
  const system = useColorScheme() ?? "light";
  const effective = theme === "system" ? system : theme;
  const palette = {
    // minimal fallback palette usage removed; rely on Themed components
    muted: "#f2f2f2",
    card: "#ffffff",
    border: "#e5e5e5",
  } as any;

  const onSend = React.useCallback(async () => {
    if (!input.trim()) return;
    const userMessage: Message = {
      id: String(Date.now()),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [userMessage, ...prev]);
    setInput("");
    try {
      setLoading(true);
      const content = await ask({ prompt: userMessage.content });
      const reply: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: content || "",
      };
      setMessages((prev) => [reply, ...prev]);
    } catch (e) {
      const reply: Message = {
        id: String(Date.now() + 1),
        role: "assistant",
        content: "Sorry, something went wrong.",
      };
      setMessages((prev) => [reply, ...prev]);
    } finally {
      setLoading(false);
    }
  }, [input, ask]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <Screen>
        <ThemedText variant="heading" style={styles.screenTitle}>
          {t("askAi")}
        </ThemedText>
        <View style={styles.inputRow}>
          <Input
            placeholder={t("promptPlaceholder")}
            value={input}
            onChange={(e: any) =>
              setInput(e?.target?.value ?? e?.nativeEvent?.text ?? "")
            }
            style={{ width: "100%", flex: 1 } as any}
          />
          <ThemedButton onPress={onSend} disabled={loading}>
            {t("send")}
          </ThemedButton>
        </View>
        <View style={styles.messages}>
          {loading && <ActivityIndicator size="small" />}
          {messages.map((m) => {
            const bubbleStyle: any = {
              padding: 16,
              borderRadius: 12,
              backgroundColor:
                m.role === "assistant" ? palette.muted : palette.card,
              borderColor: palette.border,
              borderWidth: StyleSheet.hairlineWidth,
            };
            return (
              <ThemedView key={m.id} style={bubbleStyle}>
                <ThemedText>{m.content}</ThemedText>
              </ThemedView>
            );
          })}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
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
