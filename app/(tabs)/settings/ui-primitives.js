import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { ThemedText, ThemedView, ThemedBadge, ThemedButton, ThemedCard, ThemedCheckbox, ThemedRadioGroup, ThemedRadioButton, ThemedInput, ThemedTextArea, } from "@injured/ui";
import { GlowingButton as GlowingButtonComponent } from "@injured/ui/GlowingButton";
import FormInput from "@injured/ui/FormInput";
import { useTranslation } from "@injured/i18n";
// Using named exports from the UI package root ensures types are resolved
export default function UiPrimitivesShowcase() {
    const { t } = useTranslation();
    const [toggleOn, setToggleOn] = React.useState(true);
    const [checkOn, setCheckOn] = React.useState(true);
    const [radio, setRadio] = React.useState("a");
    const Input = ThemedInput;
    const FInput = FormInput;
    const GlowingButton = GlowingButtonComponent;
    const [loading, setLoading] = React.useState(false);
    return (_jsx(Screen, { children: _jsxs(ScrollView, { contentContainerStyle: { paddingBottom: 32 }, children: [_jsx(ThemedText, { variant: "heading", style: { marginBottom: 16 }, children: t("uiShowcase") }), _jsx(Section, { title: "Base Components", children: _jsx(ThemedView, { style: { gap: 12 }, children: _jsxs(ThemedCard, { header: _jsx(ThemedText, { variant: "heading", children: "Themed Card" }), footer: _jsx(ThemedText, { variant: "caption", children: "Themed Card Footer" }), children: [_jsxs(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, children: [_jsx(ThemedBadge, { size: "md", variant: "success", children: "Medium Success" }), _jsx(ThemedBadge, { size: "lg", variant: "error", children: "Large Error" }), _jsx(ThemedBadge, { size: "sm", children: "Small Badge" })] }), _jsx(ThemedText, { variant: "heading", children: "Display Text" }), _jsx(ThemedText, { variant: "subheading", children: "Subheading Text" }), _jsx(ThemedText, { children: "Content Text" }), _jsx(ThemedText, { variant: "caption", children: "Caption Text" }), _jsx(ThemedText, { variant: "link", children: "Link Text" }), _jsx(ThemedText, { variant: "success", children: "Success Text" }), _jsx(ThemedText, { variant: "warning", children: "Warning Text" }), _jsx(ThemedText, { variant: "error", children: "Error Text" })] }) }) }), _jsx(GlowingButton, {}), _jsx(Section, { title: "Interactive", children: _jsxs(ThemedView, { style: { gap: 12 }, children: [_jsx(ThemedButton, { onPress: () => setLoading(true), loading: loading, children: "Primary Button" }), _jsx(ThemedButton, { variant: "secondary", onPress: () => setLoading(false), children: loading ? "Stop Loading" : "Secondary Button" }), _jsx(ThemedCheckbox, { label: "Checkbox", checked: checkOn, onChange: setCheckOn }), _jsx(ThemedCheckbox, { label: "Checkbox", checked: checkOn, onChange: setCheckOn, invalid: true }), _jsxs(ThemedRadioGroup, { value: radio, onValueChange: setRadio, direction: "row", gap: 12, children: [_jsx(ThemedRadioButton, { value: "a", label: "Option A" }), _jsx(ThemedRadioButton, { value: "b", label: "Option B" }), _jsx(ThemedRadioButton, { value: "c", label: "Option C" })] }), _jsx(Input, { label: "Themed Input", placeholder: "Type here", fullWidth: true }), _jsx(FInput, { label: "FormInput (default)", placeholder: "Type here", fullWidth: true }), _jsx(FInput, { label: "Email (success on valid)", placeholder: "you@example.com", keyboardType: "email-address", validate: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"), helpText: "Enter a valid email and blur to see success", fullWidth: true }), _jsx(FInput, { label: "Min length (error on < 5)", placeholder: "At least 5 chars", defaultValue: "abc", validate: (v) => (v && v.length >= 5 ? null : "Must be at least 5 characters"), fullWidth: true }), _jsx(ThemedTextArea, { label: "Text Area", placeholder: "Multiline...", minRows: 3 })] }) })] }) }));
}
function Section({ title, children }) {
    return (_jsxs(ThemedView, { style: { gap: 8, marginBottom: 24 }, children: [_jsx(ThemedText, { variant: "subheading", children: title }), children] }));
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'hsl(221 20% 11%)',
        justifyContent: 'center',
    },
    heading: {
        opacity: 0.8,
        textAlign: 'center',
        fontSize: 20,
        fontWeight: 'bold',
        color: 'white',
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
        color: 'white',
        textAlign: 'center',
        opacity: 0.6,
    },
    logoContainer: {
        marginTop: 60,
        alignItems: 'center',
    },
    logoImage: {
        width: 160,
        height: 160,
    },
});
