import type { ThemeDefinition } from './types';

export const noirTheme: ThemeDefinition = {
  id: 'noir',
  displayName: 'Noir',

  fonts: {
    heading: 'SpaceGrotesk_700Bold',
    body: 'JetBrainsMono_400Regular',
    mono: 'JetBrainsMono_400Regular',
  },

  colors: {
    light: {
      text: '#18181B',
      textSecondary: '#3F3F46',
      textMuted: '#71717A',
      textOnPrimary: '#FFFFFF',

      background: '#FAFAFA',
      backgroundCard: '#FFFFFF',
      backgroundElevated: '#FFFFFF',

      primary: '#7C3AED',
      primaryMuted: '#EDE9FE',
      accent: '#06B6D4',
      accentMuted: '#CFFAFE',

      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',

      border: 'rgba(24, 24, 27, 0.10)',
      borderLight: 'rgba(24, 24, 27, 0.05)',
      tint: '#7C3AED',
      icon: '#71717A',
      tabIconDefault: '#71717A',
      tabIconSelected: '#7C3AED',

      shadow: 'rgba(24, 24, 27, 0.08)',
      modalBackdrop: 'rgba(24, 24, 27, 0.4)',
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
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '700',
      fontFamily: 'SpaceGrotesk_700Bold',
      letterSpacing: -0.6,
    },
    subtitle: {
      fontSize: 19,
      lineHeight: 26,
      fontWeight: '700',
      fontFamily: 'SpaceGrotesk_700Bold',
      letterSpacing: -0.3,
    },
    body: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '400',
      fontFamily: 'JetBrainsMono_400Regular',
    },
    bodySemiBold: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '500',
      fontFamily: 'JetBrainsMono_500Medium',
    },
    caption: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '400',
      fontFamily: 'JetBrainsMono_400Regular',
    },
    label: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '500',
      fontFamily: 'JetBrainsMono_500Medium',
      letterSpacing: 1.0,
    },
    link: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '500',
      fontFamily: 'JetBrainsMono_500Medium',
    },
  },
};
