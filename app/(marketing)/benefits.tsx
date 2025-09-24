import React from "react";
import { FlatList, View, Dimensions } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

const slides = [
  { key: "1", title: "Recover smarter", caption: "Personalized injury guidance" },
  { key: "2", title: "Track progress", caption: "Visualize healing over time" },
  { key: "3", title: "Connect care", caption: "Share with your care team" },
];

const KEY = "hasSeenLandingPage:v1";

export default function Benefits() {
  const router = useRouter();
  const listRef = React.useRef<FlatList>(null);
  const [index, setIndex] = React.useState(0);

  const onDone = React.useCallback(async () => {
    try {
      await AsyncStorage.setItem(KEY, "true");
    } catch {}
    router.replace("/(auth)/sign-in");
  }, [router]);

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
          <ThemedText>Continue</ThemedText>
        </ThemedButton>
      </View>
    </ThemedView>
  );
}


