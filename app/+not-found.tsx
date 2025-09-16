import React from "react";
import { Link, Stack } from "expo-router";
import { useTranslation } from "@injured/i18n";
import { StyleSheet } from "react-native";

import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t("oops") }} />
      <ThemedView style={styles.container}>
        <ThemedText variant="heading">{t("screenDoesNotExist")}</ThemedText>
        <Link href="/" style={styles.link}>
          <ThemedText variant="link">{t("goHome")}</ThemedText>
        </Link>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
});
