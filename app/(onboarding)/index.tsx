import React from "react";
import { FlatList, View, Dimensions } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@injured/backend/convex/_generated/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const { width } = Dimensions.get("window");

const slides = [
  { key: "1", title: "Welcome", caption: "Set up your profile in seconds" },
  { key: "2", title: "Goal", caption: "Tell us your recovery goals" },
  { key: "3", title: "Notifications", caption: "Stay on top of milestones" },
];

export default function Onboarding() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useCurrentUser();
  const me = useQuery(api.data.users.getMe);
  const markOnboarded = useMutation(api.data.users.markOnboarded);
  const listRef = React.useRef<FlatList>(null);
  const [index, setIndex] = React.useState(0);

  const onDone = React.useCallback(async () => {
    if (!isAuthenticated || !me?.user?._id) {
      router.replace("/(auth)/sign-in");
      return;
    }
    await markOnboarded({ userId: me.user._id });
    router.replace("/(tabs)");
  }, [isAuthenticated, me?.user?._id, markOnboarded, router]);

  if (isLoading || me === undefined) return null;
  if (!isAuthenticated) {
    router.replace("/(auth)/sign-in");
    return null;
  }

  return (
    <ThemedView style={{ flex: 1, paddingVertical: 24 }}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(i);
        }}
        renderItem={({ item }) => (
          <View style={{ width, padding: 24, gap: 12 }}>
            <ThemedText variant="heading" style={{ textAlign: "center" }}>
              {item.title}
            </ThemedText>
            <ThemedText variant="default" style={{ textAlign: "center" }}>
              {item.caption}
            </ThemedText>
          </View>
        )}
      />
      <View style={{ paddingHorizontal: 24 }}>
        <ThemedButton onPress={onDone}>
          <ThemedText>Finish</ThemedText>
        </ThemedButton>
      </View>
    </ThemedView>
  );
}


