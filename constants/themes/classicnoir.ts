import type { ThemeDefinition } from './types';

export const classicnoirTheme: ThemeDefinition = {
  id: 'classicnoir',
  displayName: 'Classic Noir',

  fonts: {
    heading: 'Lora_700Bold',
    body: 'SourceSans3_400Regular',
    mono: 'SpaceMono',
  },

  colors: {
    light: {
      text: '#000000',
      textSecondary: '#27272A',
      textMuted: '#52525B',
      textOnPrimary: '#FFFFFF',

      background: '#F8F8FA',
      backgroundCard: '#FFFFFF',
      backgroundElevated: '#FFFFFF',

      primary: '#8B6AF0',
      primaryMuted: '#EAE4FE',
      accent: '#0891B2',
      accentMuted: '#C7F8FB',

      success: '#059669',
      warning: '#D97706',
      error: '#DC2626',

      border: 'rgba(0, 0, 0, 0.12)',
      borderLight: 'rgba(0, 0, 0, 0.06)',
      tint: '#8B6AF0',
      icon: '#636370',
      tabIconDefault: '#636370',
      tabIconSelected: '#8B6AF0',

      shadow: 'rgba(0, 0, 0, 0.10)',
      modalBackdrop: 'rgba(0, 0, 0, 0.45)',
    },
    dark: {
      text: '#F4F4F5',
      textSecondary: '#A1A1AA',
      textMuted: '#52525B',
      textOnPrimary: '#FFFFFF',

      background: '#09090B',
      backgroundCard: '#18181B',
      backgroundElevated: '#27272A',

      primary: '#A78BFA',
      primaryMuted: '#2E1065',
      accent: '#22D3EE',
      accentMuted: '#164E63',

      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',

      border: 'rgba(244, 244, 245, 0.10)',
      borderLight: 'rgba(244, 244, 245, 0.05)',
      tint: '#A78BFA',
      icon: '#71717A',
      tabIconDefault: '#71717A',
      tabIconSelected: '#A78BFA',

      shadow: 'rgba(0, 0, 0, 0.5)',
      modalBackdrop: 'rgba(0, 0, 0, 0.7)',
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
    sm: 2,
    md: 6,
    lg: 12,
    pill: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#18181B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 6,
    },
  },

  typography: {
    title: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '700',
      fontFamily: 'Lora_700Bold',
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700',
      fontFamily: 'Lora_700Bold',
      letterSpacing: -0.2,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      fontFamily: 'SourceSans3_400Regular',
    },
    bodySemiBold: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      fontFamily: 'SourceSans3_600SemiBold',
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'SourceSans3_400Regular',
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      fontFamily: 'SourceSans3_600SemiBold',
      letterSpacing: 0.5,
    },
    link: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '600',
      fontFamily: 'SourceSans3_600SemiBold',
    },
  },
};
