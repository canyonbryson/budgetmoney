import type { ThemeDefinition } from './types';

export const emberTheme: ThemeDefinition = {
  id: 'ember',
  displayName: 'Ember',

  fonts: {
    heading: 'Sora_700Bold',
    body: 'DMSans_400Regular',
    mono: 'SpaceMono',
  },

  colors: {
    light: {
      text: '#2D1810',
      textSecondary: '#6B4536',
      textMuted: '#A07862',
      textOnPrimary: '#FFFFFF',

      background: '#FDF8F4',
      backgroundCard: '#FFFFFF',
      backgroundElevated: '#FFFFFF',

      primary: '#E8613C',
      primaryMuted: '#FDE0D6',
      accent: '#B45309',
      accentMuted: '#FEF3C7',

      success: '#16A34A',
      warning: '#EA580C',
      error: '#DC2626',

      border: 'rgba(45, 24, 16, 0.10)',
      borderLight: 'rgba(45, 24, 16, 0.05)',
      tint: '#E8613C',
      icon: '#8B6E60',
      tabIconDefault: '#8B6E60',
      tabIconSelected: '#E8613C',

      shadow: 'rgba(45, 24, 16, 0.08)',
      modalBackdrop: 'rgba(45, 24, 16, 0.35)',
    },
    dark: {
      text: '#F5E6DE',
      textSecondary: '#C4A090',
      textMuted: '#7D5E4E',
      textOnPrimary: '#FFFFFF',

      background: '#1A0E08',
      backgroundCard: '#2A1810',
      backgroundElevated: '#36221A',

      primary: '#F0845C',
      primaryMuted: '#4A2216',
      accent: '#F59E0B',
      accentMuted: '#4A3210',

      success: '#4ADE80',
      warning: '#FB923C',
      error: '#F87171',

      border: 'rgba(245, 230, 222, 0.10)',
      borderLight: 'rgba(245, 230, 222, 0.05)',
      tint: '#F0845C',
      icon: '#8B6E60',
      tabIconDefault: '#8B6E60',
      tabIconSelected: '#F0845C',

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
    sm: 4,
    md: 10,
    lg: 18,
    pill: 999,
  },

  shadows: {
    sm: {
      shadowColor: '#2D1810',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#2D1810',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.09,
      shadowRadius: 8,
      elevation: 3,
    },
    lg: {
      shadowColor: '#2D1810',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.14,
      shadowRadius: 18,
      elevation: 6,
    },
  },

  typography: {
    title: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '700',
      fontFamily: 'Sora_700Bold',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 20,
      lineHeight: 26,
      fontWeight: '700',
      fontFamily: 'Sora_700Bold',
      letterSpacing: -0.3,
    },
    body: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '400',
      fontFamily: 'DMSans_400Regular',
    },
    bodySemiBold: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
      fontFamily: 'DMSans_500Medium',
    },
    caption: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'DMSans_400Regular',
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '500',
      fontFamily: 'DMSans_500Medium',
      letterSpacing: 0.6,
    },
    link: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: '500',
      fontFamily: 'DMSans_500Medium',
    },
  },
};
