import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, useColorScheme } from "react-native";
import { ThemedText } from "@injured/ui/ThemedText";
import { ThemedView } from "@injured/ui/ThemedView";
import { Colors } from "@/constants/Colors";
export function Collapsible({ children, title, }) {
    const [isOpen, setIsOpen] = useState(false);
    const theme = useColorScheme() ?? "light";
    return (_jsxs(ThemedView, { children: [_jsxs(TouchableOpacity, { style: styles.heading, onPress: () => setIsOpen((value) => !value), activeOpacity: 0.8, children: [_jsx(Ionicons, { name: isOpen ? "chevron-down" : "chevron-forward-outline", size: 18, color: theme === "light" ? Colors.light.icon : Colors.dark.icon }), _jsx(ThemedText, { variant: "subheading", children: title })] }), isOpen && _jsx(ThemedView, { style: styles.content, children: children })] }));
}
const styles = StyleSheet.create({
    heading: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    content: {
        marginTop: 6,
        marginLeft: 24,
    },
});
