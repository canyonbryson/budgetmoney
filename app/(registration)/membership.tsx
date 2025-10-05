import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton, ThemedCard, ThemedBadge, Icons, useThemeContext } from "@injured/ui";
import { ProgressBar, BackButton, ProfilePicture } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

interface MembershipOption {
  id: "pro-plus" | "essentials" | "basic";
  title: string;
  subtitle: string;
  price: string;
  priceBadge?: string;
  benefits: string[];
}

const MEMBERSHIP_OPTIONS: MembershipOption[] = [
  {
    id: "pro-plus",
    title: "Injured Pro+",
    subtitle: "Lifetime Access",
    price: "$2.99",
    priceBadge: "One Time Charge $99.99",
    benefits: [
      "Unlimited Access to INJURED Process",
      "Personalized Support from Surgeons & PTs",
      "Immediate Access to Expert Surgeons",
      "Discounted Sessions with PTs",
      "Educational Videos",
      "Discount on Bio-Health Products",
    ],
  },
  {
    id: "essentials",
    title: "Injured Essentials",
    subtitle: "Monthly Plan",
    price: "$4.99",
    priceBadge: "+29.99 per Injured Recovery Process",
    benefits: [
      "Priority Access to Experts.",
      "Discounted Sessions with PTs.",
      "Educational Videos",
      "Discount on Bio-Health Products",
    ],
  },
  {
    id: "basic",
    title: "Injured Basic",
    subtitle: "Free Access",
    price: "No Cost Required",
    benefits: ["Explore App", "Schedule a Consultation", "Educational Videos"],
  },
];

export default function MembershipSelectionScreen() {
  const router = useRouter();
  const { theme } = useThemeContext();
  const [selectedMembership, setSelectedMembership] =
    React.useState<MembershipOption["id"]>("pro-plus");
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => router.back();
  const handleComplete = () => router.replace("/(registration)/loading");

  const totalSteps = 16;
  const currentStep = 16;
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

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

          {/* Title */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <ProfilePicture uri={profileImageUri} size={77} borderWidth={0} />
              <View style={styles.titleTextContainer}>
                <ThemedText variant="heading" size="3xl" i18nKey="membershipTitle" />
              </View>
            </View>
            <ThemedText size="sm" i18nKey="membershipSubtitle" />
          </View>

          {/* Cards */}
            <View style={styles.cardsWrap}>
              {MEMBERSHIP_OPTIONS.map((opt) => {
                const selected = selectedMembership === opt.id;

                return (
                  <Pressable key={opt.id} onPress={() => setSelectedMembership(opt.id)}>
                    <ThemedCard
                      variant="glass"
                      isSelectable
                      isSelected={selected}
                      // height={tall}
                      radius="26px"
                      padding="22px"
                      shadowOpacity={0.34}
                      shadowRadius={10}
                      androidElevation={6}
                      highlightColor="#0F8FEA"
                    >
                      {/* Header Row */}
                      <View style={styles.cardHeader}>
                        {selected ? (
                          <Icons.checkmarkCircle width={18} height={18} />
                        ) : (
                          <View style={{ width: 18, height: 18, borderRadius: 999, borderColor: theme.colors.border, borderWidth: 1 }} />
                        )}
                        <ThemedText style={[styles.cardTitle, selected && {color: theme.colors.primary}]}>
                          {opt.title}
                        </ThemedText>

                        {opt.id === "pro-plus" ? (
                          <ThemedText variant="heading" size="lg">(Most Popular)</ThemedText>
                        ) : null}
                      </View>

                      {/* Subtitle */}
                      <ThemedText style={styles.subtitleTiny}>{opt.subtitle}</ThemedText>

                      {/* Divider */}
                      <View style={styles.hr} />

                      {/* Price + badge row */}
                      <View style={styles.priceRow}>
                        <View style={styles.priceLeft}>
                          <Icons.wallet width={24} height={20} color={theme.colors.iconSecondary}/>
                          <ThemedText>{opt.price}</ThemedText>
                        </View>
                        {opt.priceBadge ? (
                          <ThemedBadge size="sm">
                            {opt.priceBadge}
                          </ThemedBadge>
                        ) : null}
                      </View>

                      {/* Divider */}
                      <View style={[styles.hr, { marginTop: 12 }]} />

                      {/* Benefits */}
                      <View style={styles.benefits}>
                        <ThemedText>Membership Benifits</ThemedText>
                        <View style={{ height: 8 }} />
                        {opt.benefits.map((b, i) => (
                          <View style={styles.benefitRow} key={i}>
                            <Icons.bulletCheck width={14} height={14} />
                            <ThemedText>{b}</ThemedText>
                          </View>
                        ))}
                      </View>
                    </ThemedCard>
                  </Pressable>
                );
              })}
            </View>

            {/* Disclaimer */}
            <View style={styles.disclaimerSection}>
              <ThemedText>
                <ThemedText style={{color: theme.colors.primary}}>Heads up!</ThemedText>{" "}
                If you add more user accounts, there’s a small fee of $0.99/month per account,
                which includes access to the benefits you’ve selected for them.
              </ThemedText>
            </View>

            <View style={{ height: 20 }} />
          </View>
        </ScrollView>
          {/* CTA */}
          <View style={{ paddingHorizontal: 20 }}>
            <ThemedButton
              variant="primary"
              size="md"
              fullWidth
              onPress={handleComplete}
              i18nKey="confirmMembership"
            />
          </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20 },

  header: { gap: 30 },
  progressContainer: { width: "100%" },

  titleSection: { gap: 20, marginTop: 26, marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  titleTextContainer: { flex: 1 },

  scrollView: { flex: 1 },
  cardsWrap: { gap: 18, marginTop: 8 },

  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontFamily: "Inter", fontWeight: "800", fontSize: 18 },
  mostPopular: { marginLeft: 6, fontFamily: "Inter", fontSize: 14, fontWeight: "800" },

  subtitleTiny: { marginTop: 4, fontFamily: "Inter", fontSize: 12 },

  hr: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.17)",
    marginVertical: 12,
    alignSelf: "stretch",
  },

  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 10 },
  priceLeft: { flexDirection: "row", alignItems: "center", gap: 8 },

  benefits: {},
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },

  disclaimerSection: { marginTop: 14, paddingHorizontal: 6 },
});
