import type { ThemeDefinition } from './types';

export const classicTheme: ThemeDefinition = {
  id: 'classic',
  displayName: 'Classic',

  fonts: {
    heading: 'Lora_700Bold',
    body: 'SourceSans3_400Regular',
    mono: 'SpaceMono',
  },

  colors: {
    light: {
      text: '#1A1D23',
      textSecondary: '#4A5062',
      textMuted: '#8B90A0',
      textOnPrimary: '#FFFFFF',

      background: '#F7F7F9',
      backgroundCard: '#FFFFFF',
      backgroundElevated: '#FFFFFF',

      primary: '#3B5998',
      primaryMuted: '#D6DEF0',
      accent: '#C2944A',
      accentMuted: '#F0E6D2',

      success: '#2E8B57',
      warning: '#D4940A',
      error: '#C0392B',

      border: 'rgba(26, 29, 35, 0.12)',
      borderLight: 'rgba(26, 29, 35, 0.06)',
      tint: '#3B5998',
      icon: '#6B7280',
      tabIconDefault: '#6B7280',
      tabIconSelected: '#3B5998',

      shadow: 'rgba(26, 29, 35, 0.08)',
      modalBackdrop: 'rgba(26, 29, 35, 0.4)',
    },
    dark: {
      text: '#E8E9ED',
      textSecondary: '#A0A4B2',
      textMuted: '#6B7084',
      textOnPrimary: '#FFFFFF',

      background: '#13151A',
      backgroundCard: '#1C1E26',
      backgroundElevated: '#24262F',

      primary: '#6B8BD6',
      primaryMuted: '#2A3452',
      accent: '#D4A95A',
      accentMuted: '#3D3224',

      success: '#4ADE80',
      warning: '#F0B429',
      error: '#EF5350',

      border: 'rgba(232, 233, 237, 0.12)',
      borderLight: 'rgba(232, 233, 237, 0.06)',
      tint: '#6B8BD6',
      icon: '#8B90A0',
      tabIconDefault: '#8B90A0',
      tabIconSelected: '#6B8BD6',

      shadow: 'rgba(0, 0, 0, 0.3)',
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
    sm: 4,
    md: 8,
    lg: 16,
    pill: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#1A1D23',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#1A1D23',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#1A1D23',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
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
