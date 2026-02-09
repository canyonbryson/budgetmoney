import type { ThemeDefinition } from './types';

export const botanicalTheme: ThemeDefinition = {
  id: 'botanical',
  displayName: 'Botanical',

  fonts: {
    heading: 'Fraunces_700Bold',
    body: 'Outfit_400Regular',
    mono: 'SpaceMono',
  },

  colors: {
    light: {
      text: '#1B2E22',
      textSecondary: '#3D5C4A',
      textMuted: '#7A9A86',
      textOnPrimary: '#FFFFFF',

      background: '#F5F2EC',
      backgroundCard: '#FDFCF9',
      backgroundElevated: '#FFFFFF',

      primary: '#2D6A4F',
      primaryMuted: '#D1E7D9',
      accent: '#9C6644',
      accentMuted: '#EDDDD0',

      success: '#15803D',
      warning: '#CA8A04',
      error: '#B91C1C',

      border: 'rgba(27, 46, 34, 0.10)',
      borderLight: 'rgba(27, 46, 34, 0.05)',
      tint: '#2D6A4F',
      icon: '#6B8F78',
      tabIconDefault: '#6B8F78',
      tabIconSelected: '#2D6A4F',

      shadow: 'rgba(27, 46, 34, 0.07)',
      modalBackdrop: 'rgba(27, 46, 34, 0.35)',
    },
    dark: {
      text: '#E2EDE6',
      textSecondary: '#9ABCA6',
      textMuted: '#5D7D68',
      textOnPrimary: '#FFFFFF',

      background: '#0D1A12',
      backgroundCard: '#162A1E',
      backgroundElevated: '#1F3828',

      primary: '#52B788',
      primaryMuted: '#1A3D28',
      accent: '#D4A373',
      accentMuted: '#3A2D20',

      success: '#4ADE80',
      warning: '#FBBF24',
      error: '#F87171',

      border: 'rgba(226, 237, 230, 0.10)',
      borderLight: 'rgba(226, 237, 230, 0.05)',
      tint: '#52B788',
      icon: '#6B8F78',
      tabIconDefault: '#6B8F78',
      tabIconSelected: '#52B788',

      shadow: 'rgba(0, 0, 0, 0.35)',
      modalBackdrop: 'rgba(0, 0, 0, 0.6)',
    },
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 14,
    lg: 18,
    xl: 26,
    xxl: 36,
  },

  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    pill: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#1B2E22',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#1B2E22',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },
    lg: {
      shadowColor: '#1B2E22',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.11,
      shadowRadius: 18,
      elevation: 6,
    },
  },

  typography: {
    title: {
      fontSize: 32,
      lineHeight: 40,
      fontWeight: '700',
      fontFamily: 'Fraunces_700Bold',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 21,
      lineHeight: 28,
      fontWeight: '700',
      fontFamily: 'Fraunces_700Bold',
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      fontFamily: 'Outfit_400Regular',
    },
    bodySemiBold: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      fontFamily: 'Outfit_600SemiBold',
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'Outfit_400Regular',
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      fontFamily: 'Outfit_600SemiBold',
      letterSpacing: 0.5,
    },
    link: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      fontFamily: 'Outfit_600SemiBold',
    },
  },
};
