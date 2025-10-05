import { useTranslation } from "@injured/i18n";
import {
  GlowingInput,
  Icons,
  ThemedButton,
  ThemedCard,
  ThemedScreen,
  ThemedText,
  ThemedView,
  useTheme,
} from "@injured/ui";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import Screen from "@/components/ui/Screen";
import { useSettings } from "@/contexts/SettingsContext";

type QuickChat = {
  id: string;
  timeKey: string;
  title: string;
};

const PREVIOUS_CHATS: QuickChat[] = [
  { id: "today-1", timeKey: "askAiScreen.chatTimes.today", title: "askAiScreen.cardTitle_1" },
  { id: "today-2", timeKey: "askAiScreen.chatTimes.todayAlt", title: "askAiScreen.cardTitle_2" },
  { id: "monday", timeKey: "askAiScreen.chatTimes.monday", title: "askAiScreen.cardTitle_3" },
  { id: "friday", timeKey: "askAiScreen.chatTimes.friday", title: "askAiScreen.cardTitle_4" },
];

export default function AskAiScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { reducedMotion } = useSettings();
  const [input, setInput] = React.useState("");

  const navigateToChat = React.useCallback(() => {
    // stub
  }, []);

  const submit = React.useCallback(() => {
    // stub
  }, []);

  const onSubmit = React.useCallback(() => {
    if (!input.trim()) return;
    submit();
    setInput("");
  }, [input, submit]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: "padding", android: undefined })}
    >
      <ThemedScreen>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedView style={styles.heroIcon}>
              <Icons.chat width={64} height={64} color={theme.colors.primary} />
            </ThemedView>
            <ThemedText
              i18nKey="askAiScreen.title"
              size="4xl"
              weight="bold"
              style={styles.title}
              align="center"
              color={theme.colors.primary}
            >
              OrthoAgent
            </ThemedText>
            <ThemedText
              i18nKey="askAiScreen.subtitle"
              style={styles.subtitle}
              align="center"
              numberOfLines={3}
            >
              Your go-to assistant for quick answers about surgery, recovery, and
              PT.
            </ThemedText>
          </View>

          <View style={styles.inputContainer}>
            <GlowingInput
              style={styles.promptInput}
              inputStyle={{ marginRight: 75 }}
              placeholder={t("askAiScreen.placeholder")}
              value={input}
              onChangeText={setInput}
              reducedMotion={reducedMotion}
              rightIcon={
                <View style={{ flexDirection: "row"}}>
                  <TouchableOpacity
                    style={styles.iconPill}
                    onPress={navigateToChat}
                    accessibilityLabel={t("askAiScreen.attachImage")}
                  >
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={theme.colors.primaryForeground}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconPill}
                    onPress={navigateToChat}
                    accessibilityLabel={t("askAiScreen.attachDocument")}
                  >
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={theme.colors.primaryForeground}
                    />
                  </TouchableOpacity>
                </View>}
              />
          </View>

          <View style={styles.cardsGrid}>
            {PREVIOUS_CHATS.map((chat) => (
              <ThemedCard
                key={chat.id}
                variant="glass"
                padding="20px"
                margin={0}
                width={'175%'}
              >
                <View style={styles.cardContent}>
                  <ThemedText
                    weight="bold"
                    size="sm"
                    numberOfLines={2}
                  >
                    {t(chat.title)}
                  </ThemedText>
                  <ThemedText
                    size="xs"
                    i18nKey={chat.timeKey}
                  />
                </View>
                <TouchableOpacity
                  style={styles.cardFooter}
                  onPress={navigateToChat}
                  accessibilityRole="button"
                >
                  <ThemedText
                    size="xs"
                    i18nKey="askAiScreen.continueChat"
                  />
                  <Ionicons
                    name="arrow-forward-circle"
                    size={18}
                    color={theme.colors.primary}
                  />
                </TouchableOpacity>
              </ThemedCard>
            ))}
          </View>
        </ThemedView>
      </ThemedScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 32,
    gap: 30,
  },
  header: {
    alignItems: "center",
    gap: 16,
  },
  heroIcon: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 143, 234, 0.14)",
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.88,
  },
  inputContainer: {
    gap: 18,
  },
  promptGradient: {
    borderRadius: 34,
    padding: 3,
  },
  promptInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 30,
    backgroundColor: "rgba(10, 19, 31, 0.92)",
  },
  promptInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 0,
  },
  iconPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    backgroundColor: "rgba(15, 143, 234, 0.18)",
  },
  primaryAction: {
    alignSelf: "stretch",
  },
  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  },
  cardContent: {
    gap: 8,
    flex: 1,
    justifyContent: "space-between",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
  },
});
