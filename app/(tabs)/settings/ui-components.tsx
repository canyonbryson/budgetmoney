import React from "react";
import { ScrollView, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { ThemedText, ThemedView, ThemedButton, ThemedCard } from "@injured/ui";
import { useTranslation } from "@injured/i18n";
import ButtonGroup from "@injured/ui/ButtonGroup";
import Dropdown, { type DropdownOption } from "@injured/ui/Dropdown";
import ActionSheet, { type ActionSheetItem } from "@injured/ui/ActionSheet";
import ActionCard from "@injured/ui/ActionCard";
import BackButton from "@injured/ui/BackButton";
import CloseButton from "@injured/ui/CloseButton";
import SubmitIcon from "@injured/ui/SubmitIcon";

type Category =
  | "actions"
  | "commerce"
  | "communication"
  | "feedback"
  | "form"
  | "layout"
  | "overlays"
  | "popups"
  | "schedule"
  | "user";

export default function UiComponentsShowcase() {
  const { t } = useTranslation();
  const [category, setCategory] = React.useState<Category>("actions");

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <ThemedText variant="heading" style={{ marginBottom: 16 }}>
          {t("uiShowcase")}
        </ThemedText>

        <ThemedView style={{ marginBottom: 16 }}>
          <ButtonGroup
            layout="tabs"
            scrollable
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={(val) => setCategory(val as Category)}
          />
        </ThemedView>

        {category === "actions" ? <ActionsExamples /> : <ComingSoon />}
      </ScrollView>
    </Screen>
  );
}

const CATEGORY_OPTIONS: { key: Category; label: React.ReactNode }[] = [
  { key: "actions", label: "Actions" },
  { key: "commerce", label: "Commerce" },
  { key: "communication", label: "Communication" },
  { key: "feedback", label: "Feedback" },
  { key: "form", label: "Form" },
  { key: "layout", label: "Layout" },
  { key: "overlays", label: "Overlays" },
  { key: "popups", label: "Popups" },
  { key: "schedule", label: "Schedule" },
  { key: "user", label: "User" },
];

function ComingSoon() {
  return (
    <ThemedCard>
      <ThemedText>Coming soon.</ThemedText>
    </ThemedCard>
  );
}

function ActionsExamples() {
  const [dropdownValue, setDropdownValue] = React.useState<"recent" | "popular" | "rating">("recent");
  const dropdownOptions: DropdownOption<typeof dropdownValue>[] = [
    { key: "recent", label: "Most Recent" },
    { key: "popular", label: "Most Popular" },
    { key: "rating", label: "Highest Rated" },
  ];

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const sheetItems: ActionSheetItem[] = [
    { key: "camera", label: "Take Photo" },
    { key: "library", label: "Choose from Library" },
    { key: "remove", label: "Remove Photo", destructive: true },
  ];

  const [segValue, setSegValue] = React.useState("week");
  const [tabValue, setTabValue] = React.useState("overview");
  const [sepValue, setSepValue] = React.useState("medium");

  return (
    <ThemedView style={{ gap: 16 }}>
      <ThemedCard header={<ThemedText variant="subheading">Dropdown</ThemedText>}>
        <Dropdown
          label={`Sort: ${dropdownOptions.find((o) => o.key === dropdownValue)?.label}`}
          options={dropdownOptions}
          onSelect={(k) => setDropdownValue(k)}
          placement="auto"
          buttonVariant="secondary"
        />
      </ThemedCard>

      <ThemedCard header={<ThemedText variant="subheading">Action Sheet</ThemedText>}>
        <ThemedView style={{ gap: 8 }}>
          <ThemedButton onPress={() => setSheetOpen(true)}>Open Action Sheet</ThemedButton>
          <ActionSheet
            open={sheetOpen}
            onOpenChange={(v) => setSheetOpen(v)}
            items={sheetItems}
            onSelect={() => setSheetOpen(false)}
            showCancel
            cancelLabel="Cancel"
          />
        </ThemedView>
      </ThemedCard>

      <ThemedCard header={<ThemedText variant="subheading">Button Group</ThemedText>}>
        <ThemedView style={{ gap: 12 }}>
          <ButtonGroup
            layout="segmented"
            glass
            fullWidth
            options={[
              { key: "day", label: "Day" },
              { key: "week", label: "Week" },
              { key: "month", label: "Month" },
            ]}
            value={segValue}
            onChange={setSegValue}
          />

          <ButtonGroup
            layout="tabs"
            options={[
              { key: "overview", label: "Overview" },
              { key: "stats", label: "Stats" },
              { key: "reviews", label: "Reviews" },
            ]}
            value={tabValue}
            onChange={setTabValue}
          />

          <ButtonGroup
            layout="separated"
            gap={8}
            options={[
              { key: "low", label: "Low" },
              { key: "medium", label: "Medium" },
              { key: "high", label: "High", disabled: true },
            ]}
            value={sepValue}
            onChange={setSepValue}
          />
        </ThemedView>
      </ThemedCard>

      <ThemedCard header={<ThemedText variant="subheading">Action Card</ThemedText>}>
        <ActionCard
          title="Confirm email change"
          subtitle="We’ll send a verification link to your new address."
          closeIcon={<CloseButton onClose={() => {}} />}
          onClose={() => {}}
          onCancel={() => {}}
          onConfirm={() => {}}
          confirmLabel={
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <SubmitIcon width={18} height={18} />
              <ThemedText style={{ marginLeft: 6 }}>Confirm</ThemedText>
            </View>
          }
        >
          <ThemedText>Update your email to continue.</ThemedText>
        </ActionCard>
      </ThemedCard>

      <ThemedCard header={<ThemedText variant="subheading">Back/Close Buttons</ThemedText>}>
        <ThemedView style={{ flexDirection: "row", gap: 12 }}>
          <BackButton onBack={() => {}} />
          <CloseButton onClose={() => {}} />
        </ThemedView>
      </ThemedCard>
    </ThemedView>
  );
}


