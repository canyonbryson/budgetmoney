import React from "react";
import { View, StyleSheet, Pressable, StyleProp, TextStyle, ScrollView } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton, ThemedCard, Branding, Icons, useThemeContext } from "@injured/ui"; // <— Branding added
import { ProgressBar, BackButton, ProfilePicture } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type PathwayType = "athlete" | "patient";

export default function PathwaySelectionScreen() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const [selectedPathway, setSelectedPathway] = React.useState<PathwayType | null>("athlete");
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => router.back();
  const handleConfirmPathway = () => router.push("/(registration)/membership");

  const totalSteps = 16;
  const currentStep = 15;
  const progressPercent = (currentStep / totalSteps) * 100;

  const isAthlete = selectedPathway === "athlete";
  const isPatient = selectedPathway === "patient";

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <BackButton onBack={handleBack} />
            <View style={styles.progressContainer}>
              <ProgressBar
                value={progressPercent}
                height={10}
                variant="primary"
                appearance="solid"
                trackColor="#2C2F36"
                progressColor="#34C759"
              />
            </View>
          </View>

          {/* Title + avatar */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <ProfilePicture uri={profileImageUri} size={77} borderWidth={0} />
              <View style={styles.titleTextContainer}>
                <ThemedText variant="heading" size="3xl" i18nKey="pathwayTitle" />
              </View>
            </View>
            <ThemedText size="sm" i18nKey="pathwaySubtitle" />
          </View>

          {/* Pathway Cards */}
          <View style={styles.pathwayCards}>
            {/* ORTHOATHLETE — highlighted when selected */}
            <Pressable onPress={() => setSelectedPathway("athlete")}>
              <ThemedCard
                variant="glass"
                isSelectable
                isSelected={isAthlete}
                highlightColor="#0F8FEA"          // bright brand blue
                height={180}
                padding="26px"
                radius="30px"
                shadowOpacity={0.37}
                shadowRadius={7}
                androidElevation={6}
                style={styles.cardBase}
              >
                <View style={styles.brandRow}>
                  {/* Logo */}
                  <Icons.orthoAthlete style={{ width: 69, height: 70, color: isAthlete ? "#0F8FEA" : "#A3A9B3" }} />
                  {/* Wordmark */}
                  <ThemedText style={[styles.wordmark, isAthlete ? {color: theme.colors.primary} : {color: theme.colors.textTertiary}]}>
                    ORTHO<TextEm style={{color: theme.colors.textSecondary, ...styles.wordmark}}>ATHLETE</TextEm>
                  </ThemedText>
                </View>

                <View style={styles.divider} />

                <ThemedText>
                  Built for athletes and active individuals focused on returning to sport.
                </ThemedText>
              </ThemedCard>
            </Pressable>

            {/* ORTHOPATIENT — dimmed when not selected */}
            <Pressable onPress={() => setSelectedPathway("patient")}>
              <ThemedCard
                variant="glass"
                isSelectable
                isSelected={isPatient}
                highlightColor="#0F8FEA"          // bright brand blue
                height={180}
                padding="26px"
                radius="30px"
                shadowOpacity={0.28}
                shadowRadius={6}
                androidElevation={4}
                style={styles.cardBase}
              >
                <View style={styles.brandRow}>
                  <Icons.orthoPatient style={{ width: 69, height: 70, color: isPatient ? "#0F8FEA" : "#A3A9B3" }} />
                  <ThemedText style={[{color: theme.colors.textSecondary}, styles.wordmark, isPatient ? {color: theme.colors.primary} : {color: theme.colors.textTertiary}]}>
                    ORTHO<TextEm style={{color: theme.colors.textSecondary, ...styles.wordmark}}>PATIENT</TextEm>
                  </ThemedText>
                </View>

                <View style={styles.divider} />

                <ThemedText>
                  Designed for individuals recovering from surgery or injury under medical care.
                </ThemedText>
              </ThemedCard>
            </Pressable>
          </View>
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingBottom: 30 }}>
        <ThemedButton
          variant="primary"
          size="md"
          fullWidth
          onPress={handleConfirmPathway}
          i18nKey="confirmPathway"
        />
      </View>
    </ThemedView>
  );
}

/** Tiny inline component to slightly tighten the brand split text */
function TextEm({ children, style }: { children: React.ReactNode, style?: any }) {
  return <ThemedText style={{ letterSpacing: 1, ...(style ? style : {}) }}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 30 },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingVertical: 30 },
  header: { gap: 30 },
  progressContainer: { width: "100%" },

  titleSection: { gap: 20, marginTop: 30 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleTextContainer: { flex: 1 },
  pathwayCards: { gap: 18, marginTop: 28 },
  cardBase: {
    // the ThemedCard will add outer shadow + border + gradient
  },

  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  wordmark: {
    fontFamily: "Inter",
    fontWeight: "800",
    fontSize: 24,
    letterSpacing: 0.8,
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.5)",
    marginVertical: 12,
    alignSelf: "stretch",
  },
});
