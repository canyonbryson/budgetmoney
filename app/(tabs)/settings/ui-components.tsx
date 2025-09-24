import { useTranslation } from "@injured/i18n";
import {
  ThemedText,
  ThemedView,
  ThemedButton,
  ThemedCard,
  Form,
  FormInput,
  PasswordInput,
  DateInput,
  HeightInput,
  RadioGroup,
  SearchBar,
  ZipcodeInput,
  ImageInput,
} from "@injured/ui";
import { NoInternet } from "@injured/ui/ActionCard";
import ActionSheet, { type ActionSheetItem } from "@injured/ui/ActionSheet";
import BackButton from "@injured/ui/BackButton";
import ButtonGroup from "@injured/ui/ButtonGroup";
import CloseButton from "@injured/ui/CloseButton";
import Dropdown, { type DropdownOption } from "@injured/ui/Dropdown";
import { ThemedToast } from "@injured/ui/ThemedToast";
import React from "react";
import { ScrollView } from "react-native";

import Screen from "@/components/ui/Screen";

type Category =
  | "actions"
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

        {category === "actions" ? (
          <ActionsExamples />
        ) : category === "form" ? (
          <FormExamples />
        ) : (
          <ComingSoon />
        )}
      </ScrollView>
    </Screen>
  );
}

function FormExamples() {
  const [toast, setToast] = React.useState<{
    open: boolean;
    variant: "success" | "error";
    title: string;
  }>({ open: false, variant: "success", title: "" });
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [birthdate, setBirthdate] = React.useState<string | undefined>("");
  const [height, setHeight] = React.useState<{
    feet: number | undefined;
    inches: number | undefined;
  }>({ feet: undefined, inches: undefined });
  const [gender, setGender] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [select, setSelect] = React.useState<string | null>(null);
  const [zip, setZip] = React.useState<string>("");
  const [avatarUri, setAvatarUri] = React.useState<string | null>(null);

  // Basic validators
  const nameOK = name.trim().length >= 2;
  const passOK = password.length >= 8;
  const zipOK = /^(\d{5}|\d{9})$/.test(zip);

  const resetAll = () => {
    setName("");
    setPassword("");
    setBirthdate("");
    setHeight({ feet: undefined, inches: undefined });
    setGender(null);
    setSearch("");
    setSelect(null);
    setZip("");
    setAvatarUri(null);
  };

  const onSubmit = async () => {
    try {
      // simulate work
      await new Promise((r) => setTimeout(r, 800));
      setToast({
        open: true,
        variant: "success",
        title: "Saved form successfully",
      });
    } catch (e) {
      setToast({ open: true, variant: "error", title: "Failed to save form" });
    }
  };

  return (
    <ThemedView style={{ gap: 16, padding: 16 }}>
      <ThemedText variant="subheading">Form</ThemedText>
      <Form
        isValid={nameOK && passOK && zipOK}
        validate={() => nameOK && passOK && zipOK}
        onSubmit={onSubmit}
        onCancel={resetAll}
      >
        <FormInput
          label="Name"
          value={name}
          onChangeText={setName}
          validate={(v) => (v.trim().length >= 2 ? null : false)}
          fullWidth
        />

        <PasswordInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          validate={(v) => (v.length >= 8 ? null : false)}
          fullWidth
        />

        <DateInput value={birthdate} onChange={setBirthdate} />

        <HeightInput
          feet={height.feet}
          inches={height.inches}
          onChange={setHeight}
        />

        <RadioGroup
          value={gender}
          onChange={setGender}
          options={[
            { label: "Male", value: "male" },
            { label: "Female", value: "female" },
            { label: "Other", value: "other" },
          ]}
          direction="row"
        />

        <ThemedView style={{ gap: 8 }}>
          <SearchBar value={search} onChange={setSearch} onSubmit={() => {}} />
          <Dropdown
            label={select ?? "Select an option"}
            options={[
              { key: "opt1", label: "Option 1" },
              { key: "opt2", label: "Option 2" },
              { key: "opt3", label: "Option 3" },
            ]}
            onSelect={(k) => setSelect(k)}
            buttonVariant="secondary"
          />
        </ThemedView>

        <ZipcodeInput value={zip} onChange={setZip} length={5} />

        <ImageInput
          display="profile"
          uri={avatarUri ?? undefined}
          onUpload={() => setAvatarUri("https://picsum.photos/200")}
          onClear={() => setAvatarUri(null)}
          allowUpload
          allowCamera={false}
          label="Your Profile Picture"
        />
      </Form>

      <ThemedToast
        open={toast.open}
        onOpenChange={(o) => !o && setToast((t) => ({ ...t, open: false }))}
        variant={toast.variant}
        title={toast.title}
        position="bottom-center"
      />
    </ThemedView>
  );
}

const CATEGORY_OPTIONS: { key: Category; label: React.ReactNode }[] = [
  { key: "actions", label: "Actions" },
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
  const [dropdownValue, setDropdownValue] = React.useState<
    "recent" | "popular" | "rating"
  >("recent");
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

  const [open, setOpen] = React.useState(false);

  return (
    <ThemedView style={{ gap: 16 }}>
      <ThemedCard
        header={<ThemedText variant="subheading">Dropdown</ThemedText>}
      >
        <Dropdown
          label={`Sort: ${dropdownOptions.find((o) => o.key === dropdownValue)?.label}`}
          options={dropdownOptions}
          onSelect={(k) => setDropdownValue(k)}
          placement="auto"
          buttonVariant="secondary"
        />
      </ThemedCard>

      <ThemedCard
        header={<ThemedText variant="subheading">Action Sheet</ThemedText>}
      >
        <ThemedView style={{ gap: 8 }}>
          <ThemedButton onPress={() => setSheetOpen(true)}>
            Open Action Sheet
          </ThemedButton>
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

      <ThemedCard
        header={<ThemedText variant="subheading">Button Group</ThemedText>}
      >
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

      <ThemedCard
        header={<ThemedText variant="subheading">Action Card</ThemedText>}
      >
        <ThemedButton onPress={() => setOpen(true)}>
          Open Action Card
        </ThemedButton>
        <NoInternet open={open} onOpenChange={setOpen} />
      </ThemedCard>

      <ThemedCard
        header={
          <ThemedText variant="subheading">Back/Close Buttons</ThemedText>
        }
      >
        <ThemedView style={{ flexDirection: "row", gap: 12 }}>
          <BackButton onBack={() => {}} />
          <CloseButton onClose={() => {}} />
        </ThemedView>
      </ThemedCard>
    </ThemedView>
  );
}
