import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import Button from '@/components/Button';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';

export default function FamilyScreen() {
  const { language } = useSettings();
  const family = useQuery(api.families.getOrCreate);
  const updateName = useMutation(api.families.updateName);
  const addMember = useMutation(api.families.addMember);
  const removeMember = useMutation(api.families.removeMember);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');

  React.useEffect(() => {
    setName(family?.name ?? '');
  }, [family?.name]);

  if (!family) return null;

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={undefined}
    >
      <ThemedView style={styles.container}>
        <ThemedText type="title">Family</ThemedText>
        <ThemedText type="subtitle">Family name</ThemedText>
        <View style={styles.row}>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          <Button onPress={() => updateName({ name })}>Save</Button>
        </View>

        <ThemedText type="subtitle">Members</ThemedText>
        <View style={{ gap: 8 }}>
          {(family.members ?? []).map((m: any) => (
            <View key={m.email} style={styles.memberRow}>
              <ThemedText>{m.email} ({m.role})</ThemedText>
              <Button onPress={() => removeMember({ email: m.email })}>Remove</Button>
            </View>
          ))}
        </View>

        <View style={styles.row}>
          <TextInput
            placeholder="Add member by email"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button onPress={() => { if (email.trim()) { addMember({ email: email.trim() }); setEmail(''); } }}>Add</Button>
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    padding: 12,
  },
  row: {
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
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  }
});


