import type { ThemeDefinition } from './types';

export const oceanTheme: ThemeDefinition = {
  id: 'ocean',
  displayName: 'Ocean',

  fonts: {
    heading: 'Nunito_700Bold',
    body: 'Karla_400Regular',
    mono: 'SpaceMono',
  },

  colors: {
    light: {
      text: '#0F2B3C',
      textSecondary: '#3D6478',
      textMuted: '#7A9BAD',
      textOnPrimary: '#FFFFFF',

      background: '#F0F6F8',
      backgroundCard: '#FFFFFF',
      backgroundElevated: '#FFFFFF',

      primary: '#0D9488',
      primaryMuted: '#CCEDEA',
      accent: '#2563EB',
      accentMuted: '#DBEAFE',

      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',

      border: 'rgba(15, 43, 60, 0.10)',
      borderLight: 'rgba(15, 43, 60, 0.05)',
      tint: '#0D9488',
      icon: '#6B8A97',
      tabIconDefault: '#6B8A97',
      tabIconSelected: '#0D9488',

      shadow: 'rgba(15, 43, 60, 0.07)',
      modalBackdrop: 'rgba(15, 43, 60, 0.35)',
    },
    dark: {
      text: '#E0EDF3',
      textSecondary: '#8FBAC9',
      textMuted: '#567A89',
      textOnPrimary: '#FFFFFF',

      background: '#0B1820',
      backgroundCard: '#132730',
      backgroundElevated: '#1A3340',

      primary: '#2DD4BF',
      primaryMuted: '#153D38',
      accent: '#60A5FA',
      accentMuted: '#1E3A5F',

      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',

      border: 'rgba(224, 237, 243, 0.10)',
      borderLight: 'rgba(224, 237, 243, 0.05)',
      tint: '#2DD4BF',
      icon: '#6B8A97',
      tabIconDefault: '#6B8A97',
      tabIconSelected: '#2DD4BF',

      shadow: 'rgba(0, 0, 0, 0.35)',
      modalBackdrop: 'rgba(0, 0, 0, 0.6)',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },

  borderRadius: {
    sm: 6,
    md: 12,
    lg: 20,
    pill: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#0F2B3C',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    md: {
      shadowColor: '#0F2B3C',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.07,
      shadowRadius: 10,
      elevation: 3,
    },
    lg: {
      shadowColor: '#0F2B3C',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.10,
      shadowRadius: 20,
      elevation: 6,
    },
  },

  typography: {
    title: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      fontFamily: 'Nunito_700Bold',
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: '700',
      fontFamily: 'Nunito_700Bold',
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      fontFamily: 'Karla_400Regular',
    },
    bodySemiBold: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '700',
      fontFamily: 'Karla_700Bold',
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'Karla_400Regular',
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '700',
      fontFamily: 'Karla_700Bold',
      letterSpacing: 0.4,
    },
    link: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '700',
      fontFamily: 'Karla_700Bold',
    },
  },
};
