import React from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { ThemedView } from "@injured/ui/ThemedView";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedButton } from "@injured/ui/ThemedButton";
import { ProgressBar, BackButton, ProfilePicture } from "@injured/ui";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface SportCategory {
  id: string;
  titleKey: string;
  iconName: keyof typeof Ionicons.glyphMap;
  sports: string[];
}

interface Position {
  id: string;
  name: string;
}

// TODO: These would come from the database in a real app
const SPORT_CATEGORIES: SportCategory[] = [
  {
    id: "team",
    titleKey: "teamSports",
    iconName: "american-football",
    sports: ["Football", "Basketball", "Baseball", "Soccer", "Volleyball", "Lacrosse", "Ice Hockey"],
  },
  {
    id: "individual",
    titleKey: "individualSports",
    iconName: "tennisball",
    sports: ["Tennis", "Golf", "Wrestling", "Gymnastics", "Track & Field", "Boxing", "CrossFit", "Weight Lifting", "Swimming"],
  },
  {
    id: "recreational",
    titleKey: "recreationalActivities",
    iconName: "body",
    sports: ["Hiking", "Paddle Boarding", "Pickle Ball", "Biking", "Running", "Light Cardio", "Rock Climbing", "Skiing / Snowboarding"],
  },
];

// TODO: These would come from the database in a real app
const POSITIONS: Position[] = [
  { id: "qb", name: "Quarterback" },
  { id: "rb", name: "Running Back" },
  { id: "wr", name: "Wide Receiver" },
  { id: "te", name: "Tight End" },
  { id: "ol", name: "Offensive Line" },
  { id: "dl", name: "Defensive Line" },
  { id: "lb", name: "Linebacker" },
  { id: "db", name: "Defensive Back" },
  { id: "k", name: "Kicker" },
  { id: "p", name: "Punter" },
];

export default function SportsSelectionScreen() {
  const router = useRouter();
  const [selectedSports, setSelectedSports] = React.useState<string[]>([]);
  const [selectedPosition, setSelectedPosition] = React.useState<string | null>(null);
  const [showPositionDropdown, setShowPositionDropdown] = React.useState(false);
  // TODO: Get user's profile image URI from context or state
  const [profileImageUri] = React.useState<string | null>(null);

  const handleBack = () => {
    router.back();
  };

  const handleContinue = () => {
    // Stub: Will implement backend integration later
    router.push("/(registration)/pathway");
  };

  const toggleSport = (sport: string) => {
    setSelectedSports((prev) =>
      prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport]
    );
  };

  const totalSteps = 16;
  const currentStep = 14;
  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <View style={styles.content}>
          {/* Header with Back Button and Progress */}
          <View style={styles.header}>
            <BackButton onBack={handleBack} />
            <View style={styles.progressContainer}>
              <ProgressBar
                value={progressPercent}
                height={10}
                variant="primary"
                appearance="solid"
                trackColor="#999999"
                progressColor="#34C759"
              />
            </View>
          </View>

          {/* Title Section with Profile Picture */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <ProfilePicture uri={profileImageUri} size={77} borderWidth={0} />
              <View style={styles.titleTextContainer}>
                <ThemedText
                  variant="heading"
                  size="3xl"
                  i18nKey="sportsTitle"
                />
              </View>
            </View>
            <ThemedText
              i18nKey="sportsSubtitle"
            />
          </View>

          {/* Sports Categories */}
          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {SPORT_CATEGORIES.map((category) => (
              <View key={category.id} style={styles.categorySection}>
                {/* Category Header */}
                <View style={styles.categoryHeader}>
                  <Ionicons name={category.iconName} size={15} color="#0F8FEA" />
                  <ThemedText style={styles.categoryTitle} i18nKey={category.titleKey} />
                </View>

                {/* Sports Buttons */}
                <View style={styles.sportsGrid}>
                  {category.sports.map((sport) => (
                    <ThemedButton
                      key={sport}
                      variant={selectedSports.includes(sport) ? "secondary" : "ghost"}
                      size="sm"
                      style={[
                        styles.sportButton,
                        // selectedSports.includes(sport) && styles.sportButtonSelected,
                      ]}
                      onPress={() => toggleSport(sport)}
                    >
                      {sport}
                    </ThemedButton>
                  ))}
                </View>
              </View>
            ))}

            {/* Position Selection */}
            <View style={styles.positionSection}>
              <ThemedText style={styles.positionLabel} i18nKey="positionQuestion" />
              <Pressable
                style={styles.positionSelector}
                onPress={() => setShowPositionDropdown(!showPositionDropdown)}
              >
                <ThemedText style={styles.positionText}>
                  {selectedPosition ? POSITIONS.find(p => p.id === selectedPosition)?.name : "Select"}
                </ThemedText>
                <Ionicons
                  name={showPositionDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#0F8FEA"
                />
              </Pressable>

              {/* Position Dropdown */}
              {showPositionDropdown && (
                <View style={styles.positionDropdown}>
                  {POSITIONS.map((position) => (
                    <Pressable
                      key={position.id}
                      style={[
                        styles.positionOption,
                        selectedPosition === position.id && styles.positionOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedPosition(position.id);
                        setShowPositionDropdown(false);
                      }}
                    >
                      <ThemedText>{position.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>

          {/* Spacer */}
          <View style={{ height: 20 }} />

          {/* Continue Button */}
          <ThemedButton
            variant="primary"
            size="md"
            fullWidth
            onPress={handleContinue}
            i18nKey="continue"
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  header: {
    gap: 30,
  },
  progressContainer: {
    width: "100%",
  },
  titleSection: {
    gap: 20,
    marginTop: 30,
    marginBottom: 30,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  titleTextContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 30,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 15,
  },
  categoryTitle: {
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "700",
    color: "#0F8FEA",
  },
  sportsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 3,
  },
  sportButton: {
    margin: 2,
    minWidth: 80,
  },
  sportButtonSelected: {
    backgroundColor: "#0F8FEA",
  },
  positionSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  positionLabel: {
    fontFamily: "SF Pro",
    fontSize: 14,
    fontWeight: "400",
    color: "#3C3C43",
    marginBottom: 5,
  },
  positionSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CCCCCC",
  },
  positionText: {
    fontFamily: "SF Pro",
    fontSize: 12,
    fontWeight: "400",
    color: "#999999",
  },
  positionDropdown: {
    marginTop: 5,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    maxHeight: 150,
  },
  positionOption: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  positionOptionSelected: {
    backgroundColor: "#E8F4FF",
  },
});


