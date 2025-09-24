import { useTranslation } from "@injured/i18n";
import {
  ThemedText,
  ThemedView,
  ThemedBadge,
  ThemedButton,
  ThemedToggle,
  ThemedCard,
  ThemedCheckbox,
  ThemedRadioGroup,
  ThemedRadioButton,
  ThemedInput,
  ThemedTextArea,
} from "@injured/ui";
import FormInput from "@injured/ui/FormInput";
import { GlowingButton as GlowingButtonComponent } from "@injured/ui/GlowingButton";
import { router } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import Screen from "@/components/ui/Screen";

// Using named exports from the UI package root ensures types are resolved

export default function UiPrimitivesShowcase() {
  const { t } = useTranslation();
  const [toggleOn, setToggleOn] = React.useState(true);
  const [checkOn, setCheckOn] = React.useState(true);
  const [radio, setRadio] = React.useState("a");
  const Input = ThemedInput as unknown as React.ComponentType<any>;
  const FInput = FormInput as unknown as React.ComponentType<any>;
  const GlowingButton =
    GlowingButtonComponent as unknown as React.ComponentType<any>;
  const [loading, setLoading] = React.useState(false);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <ThemedText variant="heading" style={{ marginBottom: 16 }}>
          {t("uiShowcase")}
        </ThemedText>

        {/* Base primitives */}
        <Section title="Base Components">
          <ThemedView style={{ gap: 12 }}>
            <ThemedCard
              header={<ThemedText variant="heading">Themed Card</ThemedText>}
              footer={
                <ThemedText variant="caption">Themed Card Footer</ThemedText>
              }
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <ThemedBadge size="md" variant="success">
                  Medium Success
                </ThemedBadge>
                <ThemedBadge size="lg" variant="error">
                  Large Error
                </ThemedBadge>
                <ThemedBadge size="sm">Small Badge</ThemedBadge>
              </View>
              <ThemedText variant="heading">Display Text</ThemedText>
              <ThemedText variant="subheading">Subheading Text</ThemedText>
              <ThemedText>Content Text</ThemedText>
              <ThemedText variant="caption">Caption Text</ThemedText>
              <ThemedText variant="link">Link Text</ThemedText>
              <ThemedText variant="success">Success Text</ThemedText>
              <ThemedText variant="warning">Warning Text</ThemedText>
              <ThemedText variant="error">Error Text</ThemedText>
            </ThemedCard>
          </ThemedView>
        </Section>

        {/* <GlowingButton /> */}

        <Input />

        <ThemedTextArea
          label="Text Area"
          placeholder="Multiline..."
          minRows={3}
        />

        {/* Interactive */}
        <Section title="Interactive">
          <ThemedView style={{ gap: 12 }}>
            <ThemedButton onPress={() => setLoading(true)} loading={loading}>
              Primary Button
            </ThemedButton>
            <ThemedButton variant="secondary" onPress={() => setLoading(false)}>
              {loading ? "Stop Loading" : "Secondary Button"}
            </ThemedButton>
            {/* <ThemedToggle /> */}
            <ThemedCheckbox
              label="Checkbox"
              checked={checkOn}
              onChange={setCheckOn}
            />
            <ThemedCheckbox
              label="Checkbox"
              checked={checkOn}
              onChange={setCheckOn}
              invalid
            />
            <ThemedRadioGroup
              value={radio}
              onValueChange={setRadio}
              direction="row"
              gap={12}
            >
              <ThemedRadioButton value="a" label="Option A" />
              <ThemedRadioButton value="b" label="Option B" />
              <ThemedRadioButton value="c" label="Option C" />
            </ThemedRadioGroup>
            {/* FormInput states: default, focused, success, error */}
            <FInput
              label="FormInput (default)"
              placeholder="Type here"
              fullWidth
            />
            <FInput
              label="Email (success on valid)"
              placeholder="you@example.com"
              keyboardType="email-address"
              validate={(v: string) =>
                /^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"
              }
              helpText="Enter a valid email and blur to see success"
              fullWidth
            />
            <FInput
              label="Min length (error on < 5)"
              placeholder="At least 5 chars"
              defaultValue="abc"
              validate={(v: string) =>
                v && v.length >= 5 ? null : "Must be at least 5 characters"
              }
              fullWidth
            />
          </ThemedView>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ThemedView style={{ gap: 8, marginBottom: 24 }}>
      <ThemedText variant="subheading">{title}</ThemedText>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "hsl(221 20% 11%)",
    justifyContent: "center",
  },
  heading: {
    opacity: 0.8,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 24,
  },
  formContainer: {
    flex: 1,
    padding: 12,
  },
  segment: {
    margin: 24,
  },
  buttonSignUp: {
    marginTop: 12,
  },
  text: {
    marginTop: 16,
    color: "white",
    textAlign: "center",
    opacity: 0.6,
  },
  logoContainer: {
    marginTop: 60,
    alignItems: "center",
  },
  logoImage: {
    width: 160,
    height: 160,
  },
});
