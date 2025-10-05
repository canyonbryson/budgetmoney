import { useUser, useAuth } from "@clerk/clerk-expo";
import { useTranslation } from "@injured/i18n";
import {
  ThemedButton,
  ThemedCard,
  ThemedText,
  ThemedView,
  useTheme,
  Icons,
} from "@injured/ui";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Pressable,
} from "react-native";

import Screen from "@/components/ui/Screen";

type Video = {
  id: string;
  title: string;
  duration: string;
  thumbnail: string;
};

type Article = {
  id: string;
  title: string;
  thumbnail: string;
};

const FEATURED_VIDEOS: Video[] = [
  {
    id: "1",
    title: "Britain Covey's Testimony",
    duration: "5:22 m",
    thumbnail: "https://via.placeholder.com/145x92",
  },
  {
    id: "2",
    title: "London Packers Journey to Recovery",
    duration: "2:40 m",
    thumbnail: "https://via.placeholder.com/145x92",
  },
  {
    id: "3",
    title: "Jackson Buehlers Journey to Recovery",
    duration: "1:15 m",
    thumbnail: "https://via.placeholder.com/145x92",
  },
];

const MENTAL_HEALTH_ARTICLES: Article[] = [
  {
    id: "1",
    title: "Understanding Injury-Related Anxiety",
    thumbnail: "https://via.placeholder.com/145x104",
  },
  {
    id: "2",
    title: "The Mind-Body Connection in Recovery",
    thumbnail: "https://via.placeholder.com/145x104",
  },
  {
    id: "3",
    title: "How to de-stress before surgery",
    thumbnail: "https://via.placeholder.com/145x104",
  },
];

const MOBILITY_ARTICLES: Article[] = [
  {
    id: "1",
    title: "Understanding Joint Mobility: Research Behind It",
    thumbnail: "https://via.placeholder.com/145x104",
  },
  {
    id: "2",
    title: "Mobility vs. Flexibility: Key Differences",
    thumbnail: "https://via.placeholder.com/145x104",
  },
  {
    id: "3",
    title: "The Science Behind Movement",
    thumbnail: "https://via.placeholder.com/145x104",
  },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const { user } = useUser();
  const { signOut } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = React.useState(false);

  const firstName = user?.firstName || "User";

  const onSignOutPress = async () => {
    try {
      await signOut({ redirectUrl: "/" });
    } catch {}
  };

  const navigateToInjured = () => {
    router.push("/(tabs)/injured");
  };

  return (
    <Screen>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ThemedView style={styles.container}>
          {/* Header */}
          <ThemedView style={styles.header}>
            <ThemedView style={styles.welcomeContainer}>
              <ThemedText size="2xl" weight="bold" color={theme.colors.foreground}>
                {t("welcomeHome")}
              </ThemedText>
              <ThemedText size="2xl" weight="bold" color={theme.colors.primary}>
                {firstName}
              </ThemedText>
            </ThemedView>

            {/* Profile Picture with Menu */}
            <TouchableOpacity
              onPress={() => setShowProfileMenu(!showProfileMenu)}
              style={styles.profileButton}
            >
              <View style={styles.profilePicture}>
                <Image
                  source={{
                    uri:
                      user?.imageUrl ||
                      "https://via.placeholder.com/40",
                  }}
                  style={styles.profileImage}
                />
              </View>
            </TouchableOpacity>

            {/* Profile Menu */}
            {showProfileMenu && (
              <ThemedView style={[styles.profileMenu, { backgroundColor: theme.colors.background }]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowProfileMenu(false);
                    // Switch account logic
                  }}
                >
                  <ThemedText size="sm">{t("switchAccount")}</ThemedText>
                </TouchableOpacity>
                <View style={[styles.menuDivider, { backgroundColor: theme.colors.border }]} />
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowProfileMenu(false);
                    onSignOutPress();
                  }}
                >
                  <ThemedText size="sm">{t("signOut")}</ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )}
          </ThemedView>

          {/* Main Status Card */}
          <ThemedCard variant="glass" padding="30px" margin={0}>
            <ThemedView style={styles.cardContent}>
              <ThemedText size="lg" weight="bold" align="center">
                {t("strongAndSteady")}
              </ThemedText>
              <ThemedText size="sm" align="center" style={styles.description}>
                {t("strongAndSteadyDescription")}
              </ThemedText>
              <ThemedButton
                variant="primary"
                size="md"
                onPress={navigateToInjured}
                style={styles.injuredButton}
              >
                {t("injuredButton")}
              </ThemedButton>
            </ThemedView>
          </ThemedCard>

          {/* Quick Access Cards */}
          <ThemedView style={styles.quickAccessRow}>
            <ThemedCard
              variant="glass"
              padding="20px"
              margin={0}
              width={'170%'}
            >
              <ThemedView style={styles.quickCard}>
                <ThemedView style={styles.quickCardHeader}>
                  <Icons.list width={18} height={18} color={theme.colors.primary} />
                  <ThemedText size="lg" weight="bold">
                    {t("labs")}
                  </ThemedText>
                </ThemedView>
                <ThemedText size="sm" style={styles.quickCardDescription}>
                  {t("labsDescription")}
                </ThemedText>
              </ThemedView>
            </ThemedCard>

            <ThemedCard
              variant="glass"
              padding="20px"
              margin={0}
              width={'170%'}
            >
              <ThemedView style={styles.quickCard}>
                <ThemedView style={styles.quickCardHeader}>
                  <Icons.chat width={18} height={18} color={theme.colors.primary} />
                  <ThemedText size="lg" weight="bold">
                    {t("messages")}
                  </ThemedText>
                </ThemedView>
                <ThemedText size="sm" style={styles.quickCardDescription}>
                  {t("messagesDescription")}
                </ThemedText>
              </ThemedView>
            </ThemedCard>
          </ThemedView>

          {/* Appointments Card */}
          <ThemedCard variant="glass" padding="30px" margin={0}>
            <ThemedView style={styles.cardContent}>
              <ThemedText size="lg" weight="bold">
                {t("appointments")}
              </ThemedText>
              <ThemedText size="sm">{t("noAppointments")}</ThemedText>
            </ThemedView>
          </ThemedCard>

          {/* Preventative Measures Section */}
          <ThemedView style={styles.section}>
            <ThemedText size="2xl" weight="bold">
              {t("preventativeMeasures")}
            </ThemedText>
            <ThemedText size="sm" style={styles.sectionDescription}>
              {t("preventativeMeasuresDescription")}
            </ThemedText>
          </ThemedView>

          {/* Featured Videos */}
          <ThemedView style={styles.section}>
            <ThemedText size="lg" weight="bold">
              {t("featuredVideos")}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
            >
              {FEATURED_VIDEOS.map((video) => (
                <Pressable key={video.id} style={styles.videoCard}>
                  <Image
                    source={{ uri: video.thumbnail }}
                    style={styles.videoThumbnail}
                  />
                  <ThemedText size="sm" numberOfLines={2} style={styles.videoTitle}>
                    {video.title}
                  </ThemedText>
                  <ThemedText
                    size="xs"
                    color={theme.colors.textSecondary}
                    style={styles.videoDuration}
                  >
                    {video.duration}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </ThemedView>

          {/* Mental Health Articles */}
          <ThemedView style={styles.section}>
            <ThemedText size="lg" weight="bold">
              {t("mentalHealth")}
            </ThemedText>
            {MENTAL_HEALTH_ARTICLES.map((article) => (
              <ThemedView key={article.id} style={styles.articleRow}>
                <Image
                  source={{ uri: article.thumbnail }}
                  style={styles.articleThumbnail}
                />
                <ThemedView style={styles.articleContent}>
                  <ThemedText size="sm" numberOfLines={3} style={styles.articleTitle}>
                    {article.title}
                  </ThemedText>
                  <ThemedButton variant="primary" size="sm">
                    {t("readStudy")}
                  </ThemedButton>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>

          {/* Mobility Articles */}
          <ThemedView style={styles.section}>
            <ThemedText size="lg" weight="bold">
              {t("mobility")}
            </ThemedText>
            {MOBILITY_ARTICLES.map((article) => (
              <ThemedView key={article.id} style={styles.articleRow}>
                <Image
                  source={{ uri: article.thumbnail }}
                  style={styles.articleThumbnail}
                />
                <ThemedView style={styles.articleContent}>
                  <ThemedText size="sm" numberOfLines={3} style={styles.articleTitle}>
                    {article.title}
                  </ThemedText>
                  <ThemedButton variant="primary" size="sm">
                    {t("readStudy")}
                  </ThemedButton>
                </ThemedView>
              </ThemedView>
            ))}
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  container: {
    gap: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    position: "relative",
  },
  welcomeContainer: {
    gap: 4,
  },
  profileButton: {
    position: "relative",
  },
  profilePicture: {
    width: 43,
    height: 43,
    borderRadius: 22,
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  profileMenu: {
    position: "absolute",
    top: 50,
    right: 0,
    borderRadius: 12,
    padding: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 150,
    zIndex: 1000,
  },
  menuItem: {
    padding: 12,
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
  },
  cardContent: {
    gap: 15,
  },
  description: {
    opacity: 0.7,
  },
  injuredButton: {
    marginTop: 5,
  },
  quickAccessRow: {
    flexDirection: "row",
    width: "100%",
    paddingRight: 20, // Not sure why this is needed but it is
    justifyContent: "space-between",
  },
  quickCard: {
    gap: 10,
  },
  quickCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  quickCardDescription: {
    opacity: 0.7,
  },
  section: {
    gap: 10,
  },
  sectionDescription: {
    opacity: 0.8,
    lineHeight: 20,
  },
  horizontalScroll: {
    marginLeft: -20,
    paddingLeft: 20,
  },
  videoCard: {
    width: 145,
    marginRight: 15,
  },
  videoThumbnail: {
    width: 145,
    height: 92,
    borderRadius: 16,
    marginBottom: 8,
  },
  videoTitle: {
    marginBottom: 4,
  },
  videoDuration: {
    marginTop: 2,
  },
  articleRow: {
    flexDirection: "row",
    gap: 15,
    marginBottom: 15,
  },
  articleThumbnail: {
    width: 145,
    height: 104,
    borderRadius: 16,
  },
  articleContent: {
    flex: 1,
    gap: 10,
    justifyContent: "space-between",
  },
  articleTitle: {
    flex: 1,
  },
});
