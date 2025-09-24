import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { useMutation, useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
import React from "react";
import { FlatList, TextInput, View } from "react-native";

import Screen from "@/components/ui/Screen";

function ContactsSection() {
  const me = useQuery(api.data.users.getMe);
  const myContacts = useQuery(
    api.data.users.listUserContacts,
    me?.user?._id ? { userId: me.user._id } : "skip",
  );
  const addMyContact = useMutation(api.data.users.addUserContact);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");

  if (me === undefined || myContacts === undefined)
    return (
      <ThemedView style={{ gap: 8, marginBottom: 24 }}>
        <ThemedText variant="subheading">Contacts</ThemedText>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  if (!me?.user)
    return (
      <ThemedView style={{ gap: 8, marginBottom: 24 }}>
        <ThemedText variant="subheading">Contacts</ThemedText>
        <ThemedText>Sign in to view and manage contacts.</ThemedText>
      </ThemedView>
    );

  return (
    <ThemedView style={{ gap: 8, marginBottom: 24 }}>
      <ThemedText variant="subheading">Contacts</ThemedText>
      <View style={{ gap: 6 }}>
        <TextInput
          placeholder="First name"
          value={firstName}
          onChangeText={setFirstName}
          style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        />
        <TextInput
          placeholder="Last name"
          value={lastName}
          onChangeText={setLastName}
          style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        />
        <TextInput
          placeholder="Phone (+15551234567)"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        />
        <ThemedButton
          onPress={async () => {
            if (!me?.user?._id) return;
            const label = `${firstName} ${lastName}`.trim();
            await addMyContact({
              userId: me.user._id,
              contact: {
                type: "PHONE",
                value: phoneNumber,
                label: label.length ? label : undefined,
              },
            });
            setFirstName("");
            setLastName("");
            setPhoneNumber("");
          }}
        >
          Add Contact
        </ThemedButton>
      </View>

      <ThemedText style={{ marginTop: 8 }}>Existing</ThemedText>
      <FlatList
        data={(myContacts as any) ?? []}
        keyExtractor={(item) => String(item._id)}
        renderItem={({ item }) => (
          <ThemedText>
            {item.firstName ?? ""} {item.lastName ?? ""} — {item.phoneNumber ?? ""}
          </ThemedText>
        )}
      />
    </ThemedView>
  );
}

export default function DataManagement() {
  const { isLoading, isAuthenticated } = useCurrentUser();

  const me = useQuery(api.data.users.getMe);
  const userSettings = useQuery(
    api.data.users.getUserSettings,
    me?.user?._id ? { userId: me.user._id } : "skip",
  );
  const listRequests = useQuery(
    api.data.users.listMyDataRequests,
    me?.user?._id ? { userId: me.user._id } : "skip",
  );

  const setPrefs = useMutation(api.data.users.setUserSettings);
  const requestExport = useMutation(api.data.users.requestDataExport);
  const requestDeletion = useMutation(api.data.users.requestDataDeletion);

  const [marketingOptIn, setMarketingOptIn] = React.useState<boolean>(false);
  React.useEffect(() => {
    if (userSettings) {
      setMarketingOptIn(Boolean((userSettings as any)?.marketingOptIn));
    }
  }, [userSettings]);

  const [notes, setNotes] = React.useState<string>("");

  const onSavePrefs = React.useCallback(async () => {
    if (!me?.user?._id) return;
    await setPrefs({ userId: me.user._id, patch: { marketingOptIn } as any });
  }, [me?.user?._id, marketingOptIn, setPrefs]);

  const onRequest = React.useCallback(
    async (type: "EXPORT" | "DELETE") => {
      if (!me?.user?._id) return;
      if (type === "EXPORT") await requestExport({ userId: me.user._id, notes });
      else await requestDeletion({ userId: me.user._id, notes });
      setNotes("");
    },
    [me?.user?._id, notes, requestExport, requestDeletion],
  );

  if (isLoading || me === undefined)
    return (
      <Screen>
        <ThemedText>Loading…</ThemedText>
      </Screen>
    );
  if (!isAuthenticated || !me?.user)
    return (
      <Screen>
        <ThemedText>You need to sign in to manage your data.</ThemedText>
      </Screen>
    );

  return (
    <Screen>
      <ThemedText variant="heading" style={{ marginBottom: 16 }}>
        Data Management
      </ThemedText>

      <ThemedView style={{ gap: 8, marginBottom: 24 }}>
        <ThemedText variant="subheading">Preferences</ThemedText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ThemedText>Marketing Opt-in</ThemedText>
          <ThemedButton
            onPress={() => setMarketingOptIn((v) => !v)}
            style={{ paddingHorizontal: 12 }}
          >
            {marketingOptIn ? "On" : "Off"}
          </ThemedButton>
        </View>
        <ThemedButton onPress={onSavePrefs}>Save Preferences</ThemedButton>
      </ThemedView>

      <ContactsSection />

      <ThemedView style={{ gap: 8, marginBottom: 24 }}>
        <ThemedText variant="subheading">HIPAA</ThemedText>
        <ThemedText>Change/record acknowledgement handled by support.</ThemedText>
      </ThemedView>

      <ThemedView style={{ gap: 8, marginBottom: 24 }}>
        <ThemedText variant="subheading">Data Requests</ThemedText>
        <TextInput
          placeholder="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <ThemedButton onPress={() => onRequest("EXPORT")}>
            Request Export
          </ThemedButton>
          <ThemedButton onPress={() => onRequest("DELETE")}>
            Request Deletion
          </ThemedButton>
        </View>
        <ThemedText style={{ marginTop: 8 }}>My Requests</ThemedText>
        <FlatList
          data={(listRequests as any) ?? []}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item }) => (
            <ThemedText>
              {item.resourceType}:{item.resourceId} - {item.changes?.status ?? "PENDING"}
            </ThemedText>
          )}
        />
      </ThemedView>
    </Screen>
  );
}


