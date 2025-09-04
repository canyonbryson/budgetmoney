import React from 'react'
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, ActivityIndicator, useColorScheme } from 'react-native';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import Screen from '@/components/ui/Screen';
import Button from '@/components/ui/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { themes } from '@injured/ui/theme';


type Message = { id: string; role: 'user' | 'assistant'; content: string };

export default function AskAiScreen() {
  const { language, theme } = useSettings();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const ask = useAction(api.ask_ai.ask);
  const system = useColorScheme() ?? 'light';
  const effective = theme === 'system' ? system : theme;
  const palette = effective === 'dark' ? themes.dark.colors : themes.light.colors;

  const onSend = React.useCallback(async () => {
    if (!input.trim()) return;
    const userMessage: Message = { id: String(Date.now()), role: 'user', content: input.trim() };
    setMessages(prev => [userMessage, ...prev]);
    setInput('');
    try {
      setLoading(true);
      const content = await ask({ prompt: userMessage.content });
      const reply: Message = { id: String(Date.now() + 1), role: 'assistant', content: content || '' };
      setMessages(prev => [reply, ...prev]);
    } catch (e) {
      const reply: Message = { id: String(Date.now() + 1), role: 'assistant', content: 'Sorry, something went wrong.' };
      setMessages(prev => [reply, ...prev]);
    } finally {
      setLoading(false);
    }
  }, [input, ask]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <Screen>
        <ThemedText type="title" style={styles.screenTitle}>{t(language, 'askAi')}</ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, { borderColor: palette.input, color: palette.foreground }]}
            placeholder={t(language, 'promptPlaceholder')}
            value={input}
            onChangeText={setInput}
            autoCorrect
            autoCapitalize="sentences"
            returnKeyType="send"
            onSubmitEditing={onSend}
          />
          <Button onPress={onSend} disabled={loading}>{t(language, 'send')}</Button>
        </View>
        <View style={styles.messages}>
          {loading && <ActivityIndicator size="small" />}
          {messages.map(m => (
            <ThemedView
              key={m.id}
              style={[
                styles.message,
                { backgroundColor: m.role === 'assistant' ? palette.muted : palette.card, borderColor: palette.border, borderWidth: StyleSheet.hairlineWidth },
              ]}
            >
              <ThemedText>{m.content}</ThemedText>
            </ThemedView>
          ))}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  messages: {
    flex: 1,
    gap: 12
  },
  message: {
    padding: 16,
    borderRadius: 12
  }
});


