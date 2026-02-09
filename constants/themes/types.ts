import type { TextStyle } from 'react-native';

// ── Identifiers ──────────────────────────────────────────────────────

export type ThemeId = 'classic' | 'ocean' | 'ember' | 'botanical' | 'noir' | 'classicnoir';

export type ColorScheme = 'light' | 'dark';

// ── Colors ───────────────────────────────────────────────────────────

export type ThemeColors = {
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // Backgrounds
  background: string;
  backgroundCard: string;
  backgroundElevated: string;

  // Brand
  primary: string;
  primaryMuted: string;
  accent: string;
  accentMuted: string;

  // Semantic
  success: string;
  warning: string;
  error: string;

  // Chrome
  border: string;
  borderLight: string;
  tint: string;
  icon: string;
  tabIconDefault: string;
  tabIconSelected: string;

  // Overlay
  shadow: string;
  modalBackdrop: string;
};

// ── Fonts ────────────────────────────────────────────────────────────

export type ThemeFonts = {
  heading: string;
  body: string;
  mono: string;
};

// ── Spacing ──────────────────────────────────────────────────────────

export type ThemeSpacing = {
  xs: number;  // 4
  sm: number;  // 8
  md: number;  // 12
  lg: number;  // 16
  xl: number;  // 24
  xxl: number; // 32
};

// ── Border Radius ────────────────────────────────────────────────────

export type ThemeBorderRadius = {
  sm: number;  // 4
  md: number;  // 8
  lg: number;  // 16
  pill: number; // 999
};

// ── Shadows ──────────────────────────────────────────────────────────

export type ThemeShadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export type ThemeShadows = {
  sm: ThemeShadow;
  md: ThemeShadow;
  lg: ThemeShadow;
};

// ── Typography ───────────────────────────────────────────────────────

export type TypographyPreset = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'fontFamily' | 'letterSpacing'
>;

export type ThemeTypography = {
  title: TypographyPreset;
  subtitle: TypographyPreset;
  body: TypographyPreset;
  bodySemiBold: TypographyPreset;
  caption: TypographyPreset;
  label: TypographyPreset;
  link: TypographyPreset;
};

// ── Full Theme Definition ────────────────────────────────────────────

export type ThemeDefinition = {
  id: ThemeId;
  displayName: string;
  fonts: ThemeFonts;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  typography: ThemeTypography;
};

// ── Resolved Theme (colors flattened for current scheme) ─────────────

export type ResolvedTheme = {
  id: ThemeId;
  displayName: string;
  colorScheme: ColorScheme;
  fonts: ThemeFonts;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows: ThemeShadows;
  typography: ThemeTypography;
};
