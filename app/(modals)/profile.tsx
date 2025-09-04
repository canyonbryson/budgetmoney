import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import ParallaxScrollView from '@/components/ui/ParallaxScrollView';
import { ThemedText } from '@/components/ui/ThemedText';
import { ThemedView } from '@/components/ui/ThemedView';
import Button from '@/components/ui/Button';
import { useSettings } from '@/contexts/SettingsContext';
import { t } from '@/i18n';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useUser } from '@clerk/clerk-expo';

export default function ProfileScreen() {
  const { language } = useSettings();
  const { user } = useUser();
  const clerkUserId = user?.id;
  const userDoc = useQuery(api.auth.users.getUserByClerkUserId, clerkUserId ? { clerkUserId } : 'skip');
  const [name, setName] = React.useState('');
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const updateProfile = useMutation(api.auth.users.updateUserProfile);

  React.useEffect(() => {
    if (userDoc) {
      setName(userDoc.name ?? '');
    }
  }, [userDoc?.name]);

  if (!userDoc) return null;

  return (
    <ParallaxScrollView headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}>
      <ThemedView style={styles.container}>
        <ThemedText type="title">{t(language, 'settings')}</ThemedText>
        <ThemedText type="subtitle">Profile</ThemedText>

        <ThemedText type="default">Name</ThemedText>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <ThemedText type="default">First name</ThemedText>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} />

        <ThemedText type="default">Last name</ThemedText>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />

        <ThemedText type="default">Bio</ThemedText>
        <TextInput style={[styles.input, { height: 80 }]} multiline value={bio} onChangeText={setBio} />

        <Button
          onPress={async () => {
            await updateProfile({
              userId: userDoc._id,
              name,
              firstName,
              lastName,
              bio,
            });
          }}
        >Save</Button>
      </ThemedView>
    </ParallaxScrollView>
  );
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
    borderColor: 'rgba(0,0,0,0.11)'
  },
});


