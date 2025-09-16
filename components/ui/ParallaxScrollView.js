import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { StyleSheet, useColorScheme } from "react-native";
import Animated, { interpolate, useAnimatedRef, useAnimatedStyle, useScrollViewOffset, } from "react-native-reanimated";
import { ThemedView } from "@injured/ui/ThemedView";
import { useSettings } from "@/contexts/SettingsContext";
const HEADER_HEIGHT = 250;
export default function ParallaxScrollView({ children, headerImage, headerBackgroundColor, }) {
    const colorScheme = useColorScheme() ?? "light";
    const { reducedMotion } = useSettings();
    const scrollRef = useAnimatedRef();
    const scrollOffset = useScrollViewOffset(scrollRef);
    const headerAnimatedStyle = useAnimatedStyle(() => {
        if (reducedMotion) {
            return { transform: [{ translateY: 0 }, { scale: 1 }] };
        }
        return {
            transform: [
                {
                    translateY: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75]),
                },
                {
                    scale: interpolate(scrollOffset.value, [-HEADER_HEIGHT, 0, HEADER_HEIGHT], [2, 1, 1]),
                },
            ],
        };
    });
    return (_jsx(ThemedView, { style: styles.container, children: _jsxs(Animated.ScrollView, { ref: scrollRef, scrollEventThrottle: reducedMotion ? 0 : 16, children: [_jsx(Animated.View, { style: [
                        styles.header,
                        { backgroundColor: headerBackgroundColor[colorScheme] },
                        headerAnimatedStyle,
                    ], children: headerImage }), _jsx(ThemedView, { style: styles.content, children: children })] }) }));
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        height: 250,
        overflow: "hidden",
    },
    content: {
        flex: 1,
        padding: 32,
        gap: 16,
        overflow: "hidden",
    },
});
