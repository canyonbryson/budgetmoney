import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@injured/backend/convex/_generated/api";
import { useTranslation } from "@injured/i18n";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useMutation, useQuery } from "convex/react";
import React from "react";
import { StyleSheet, TextInput, View } from "react-native";

import ParallaxScrollView from "@/components/ui/ParallaxScrollView";
import { useSettings } from "@/contexts/SettingsContext";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { language } = useSettings();
  const { user } = useUser();
  const externalId = user?.id;
  const userDoc = useQuery(
    api.auth.users.getUserByClerkUserId,
    externalId ? { externalId } : "skip",
  );
  const profileDoc = useQuery(
    api["data/users"].getUserSettings,
    userDoc?._id ? { userId: userDoc._id } : "skip",
  );
  const [name, setName] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const updateProfile = useMutation(api.auth.users.updateUserProfile);

  React.useEffect(() => {
    if (userDoc) {
      setName(userDoc.name ?? "");
    }
    if (profileDoc) {
      setFirstName((profileDoc as any)?.firstName ?? "");
      setLastName((profileDoc as any)?.lastName ?? "");
      setBio((profileDoc as any)?.bio ?? "");
    }
  }, [userDoc?.name, profileDoc]);

  if (userDoc === undefined || profileDoc === undefined) {
    return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
        headerImage={
          <Ionicons size={310} name="people" style={styles.headerImage} />
        }
      >
        <ThemedView style={styles.container}>
          <ThemedText>Loading…</ThemedText>
        </ThemedView>
      </ParallaxScrollView>
    );
  }
  if (!userDoc) {
    return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
        headerImage={
          <Ionicons size={310} name="people" style={styles.headerImage} />
        }
      >
        <ThemedView style={styles.container}>
          <ThemedText>Sign in to edit your profile.</ThemedText>
        </ThemedView>
      </ParallaxScrollView>
    );
  }

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#D0D0D0", dark: "#353636" }}
      headerImage={
        <Ionicons size={310} name="people" style={styles.headerImage} />
      }
    >
      <ThemedView style={styles.container}>
        <ThemedText variant="heading">{t("settings")}</ThemedText>
        <ThemedText variant="subheading">Profile</ThemedText>

        <ThemedText variant="default">Name</ThemedText>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <ThemedText variant="default">First name</ThemedText>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
        />

        <ThemedText variant="default">Last name</ThemedText>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
        />

        <ThemedText variant="default">Bio</ThemedText>
        <TextInput
          style={[styles.input, { height: 80 }]}
          multiline
          value={bio}
          onChangeText={setBio}
        />

        <ThemedButton
          onPress={async () => {
            await updateProfile({
              userId: userDoc._id,
              name,
              firstName,
              lastName,
              bio,
            });
          }}
        >
          Save
        </ThemedButton>
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
    borderColor: "rgba(0,0,0,0.11)",
  },
  headerImage: {
    marginBottom: 0,
  },
});
