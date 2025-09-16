import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import { ScrollView, View } from "react-native";
import Screen from "@/components/ui/Screen";
import { ThemedText, ThemedView, ThemedButton, ThemedCard } from "@injured/ui";
import { useTranslation } from "@injured/i18n";
import ButtonGroup from "@injured/ui/ButtonGroup";
import Dropdown from "@injured/ui/Dropdown";
import ActionSheet from "@injured/ui/ActionSheet";
import ActionCard from "@injured/ui/ActionCard";
import BackButton from "@injured/ui/BackButton";
import CloseButton from "@injured/ui/CloseButton";
import SubmitIcon from "@injured/ui/SubmitIcon";
export default function UiComponentsShowcase() {
    const { t } = useTranslation();
    const [category, setCategory] = React.useState("actions");
    return (_jsx(Screen, { children: _jsxs(ScrollView, { contentContainerStyle: { paddingBottom: 32 }, children: [_jsx(ThemedText, { variant: "heading", style: { marginBottom: 16 }, children: t("uiShowcase") }), _jsx(ThemedView, { style: { marginBottom: 16 }, children: _jsx(ButtonGroup, { layout: "tabs", scrollable: true, options: CATEGORY_OPTIONS, value: category, onChange: (val) => setCategory(val) }) }), category === "actions" ? _jsx(ActionsExamples, {}) : _jsx(ComingSoon, {})] }) }));
}
const CATEGORY_OPTIONS = [
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
    return (_jsx(ThemedCard, { children: _jsx(ThemedText, { children: "Coming soon." }) }));
}
function ActionsExamples() {
    const [dropdownValue, setDropdownValue] = React.useState("recent");
    const dropdownOptions = [
        { key: "recent", label: "Most Recent" },
        { key: "popular", label: "Most Popular" },
        { key: "rating", label: "Highest Rated" },
    ];
    const [sheetOpen, setSheetOpen] = React.useState(false);
    const sheetItems = [
        { key: "camera", label: "Take Photo" },
        { key: "library", label: "Choose from Library" },
        { key: "remove", label: "Remove Photo", destructive: true },
    ];
    const [segValue, setSegValue] = React.useState("week");
    const [tabValue, setTabValue] = React.useState("overview");
    const [sepValue, setSepValue] = React.useState("medium");
    return (_jsxs(ThemedView, { style: { gap: 16 }, children: [_jsx(ThemedCard, { header: _jsx(ThemedText, { variant: "subheading", children: "Dropdown" }), children: _jsx(Dropdown, { label: `Sort: ${dropdownOptions.find((o) => o.key === dropdownValue)?.label}`, options: dropdownOptions, onSelect: (k) => setDropdownValue(k), placement: "auto", buttonVariant: "secondary" }) }), _jsx(ThemedCard, { header: _jsx(ThemedText, { variant: "subheading", children: "Action Sheet" }), children: _jsxs(ThemedView, { style: { gap: 8 }, children: [_jsx(ThemedButton, { onPress: () => setSheetOpen(true), children: "Open Action Sheet" }), _jsx(ActionSheet, { open: sheetOpen, onOpenChange: (v) => setSheetOpen(v), items: sheetItems, onSelect: () => setSheetOpen(false), showCancel: true, cancelLabel: "Cancel" })] }) }), _jsx(ThemedCard, { header: _jsx(ThemedText, { variant: "subheading", children: "Button Group" }), children: _jsxs(ThemedView, { style: { gap: 12 }, children: [_jsx(ButtonGroup, { layout: "segmented", glass: true, fullWidth: true, options: [
                                { key: "day", label: "Day" },
                                { key: "week", label: "Week" },
                                { key: "month", label: "Month" },
                            ], value: segValue, onChange: setSegValue }), _jsx(ButtonGroup, { layout: "tabs", options: [
                                { key: "overview", label: "Overview" },
                                { key: "stats", label: "Stats" },
                                { key: "reviews", label: "Reviews" },
                            ], value: tabValue, onChange: setTabValue }), _jsx(ButtonGroup, { layout: "separated", gap: 8, options: [
                                { key: "low", label: "Low" },
                                { key: "medium", label: "Medium" },
                                { key: "high", label: "High", disabled: true },
                            ], value: sepValue, onChange: setSepValue })] }) }), _jsx(ThemedCard, { header: _jsx(ThemedText, { variant: "subheading", children: "Action Card" }), children: _jsx(ActionCard, { title: "Confirm email change", subtitle: "We\u2019ll send a verification link to your new address.", closeIcon: _jsx(CloseButton, { onClose: () => { } }), onClose: () => { }, onCancel: () => { }, onConfirm: () => { }, confirmLabel: _jsxs(View, { style: { flexDirection: "row", alignItems: "center" }, children: [_jsx(SubmitIcon, { width: 18, height: 18 }), _jsx(ThemedText, { style: { marginLeft: 6 }, children: "Confirm" })] }), children: _jsx(ThemedText, { children: "Update your email to continue." }) }) }), _jsx(ThemedCard, { header: _jsx(ThemedText, { variant: "subheading", children: "Back/Close Buttons" }), children: _jsxs(ThemedView, { style: { flexDirection: "row", gap: 12 }, children: [_jsx(BackButton, { onBack: () => { } }), _jsx(CloseButton, { onClose: () => { } })] }) })] }));
}
