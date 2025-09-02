import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

type Message = { id: string; role: 'user' | 'assistant'; content: string };

export default function AskAiScreen() {
  const { language } = useSettings();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const ask = useAction(api.ask_ai.ask);

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
      <ThemedView style={styles.container}>
        <ThemedText type="title">{t(language, 'askAi')}</ThemedText>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
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
            <ThemedView key={m.id} style={[styles.message, m.role === 'assistant' ? styles.assistant : styles.user]}>
              <ThemedText>{m.content}</ThemedText>
            </ThemedView>
          ))}
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    gap: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    borderColor: 'rgba(0,0,0,0.11)'
  },
  messages: {
    flex: 1,
    gap: 8,
  },
  message: {
    padding: 10,
    borderRadius: 8,
  },
  assistant: {
    backgroundColor: 'rgba(0,0,0,0.06)'
  },
  user: {
    backgroundColor: 'rgba(0,0,0,0.02)'
  }
});


