/**
 * Modern Theme System
 * File Path: constants/theme.ts
 * 
 * Comprehensive design system with contemporary aesthetics.
 * Provides consistent theming across the entire application.
 */

/**
 * Modern color palette with sophisticated gradients and depth
 */
export const colors = {
  // Primary brand colors - Modern emerald and slate
  primary: '#059669',
  primaryLight: '#10B981',
  primaryDark: '#047857',
  primaryAlpha: 'rgba(5, 150, 105, 0.1)',

  // Background system with subtle gradients
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  
  // Text hierarchy with warm grays
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textMuted: '#D1D5DB',
  textInverse: '#FFFFFF',

  // Accent colors - Sophisticated purple-blue
  accent: '#3B82F6',
  accentLight: '#60A5FA',
  accentDark: '#2563EB',
  accentAlpha: 'rgba(59, 130, 246, 0.1)',

  // Status colors with modern tones
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#06B6D4',
  infoLight: '#CFFAFE',

  // Border and dividers
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  divider: '#D1D5DB',

  // Interactive states
  hover: 'rgba(0, 0, 0, 0.04)',
  pressed: 'rgba(0, 0, 0, 0.08)',
  focus: 'rgba(59, 130, 246, 0.2)',

  // Overlay and shadows
  overlay: 'rgba(17, 24, 39, 0.7)',
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowStrong: 'rgba(0, 0, 0, 0.25)',
} as const;

/**
 * Modern typography system with refined hierarchy
 */
export const typography = {
  // Font sizes with golden ratio progression
  sizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
    '6xl': 48,
  },

  // Font weights for visual hierarchy
  weights: {
    light: '300' as const,
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  // Line heights for optimal readability
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8,
  },

  // Letter spacing for refined text
  letterSpacing: {
    tight: -0.025,
    normal: 0,
    wide: 0.025,
    wider: 0.05,
  },
} as const;

/**
 * Consistent spacing system based on 4px grid
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
  '7xl': 80,
  '8xl': 96,
} as const;

/**
 * Border radius system for modern, friendly interfaces
 */
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  '3xl': 24,
  full: 9999,
} as const;

/**
 * Sophisticated shadow system with multiple layers
 */
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  
  xl: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },

  '2xl': {
    shadowColor: colors.shadowStrong,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

/**
 * Modern gradient definitions for visual depth
 */
export const gradients = {
  primary: ['#059669', '#10B981'],
  accent: ['#3B82F6', '#60A5FA'],
  surface: ['#FFFFFF', '#F8FAFC'],
  overlay: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'],
} as const;

/**
 * Animation timing functions for smooth interactions
 */
export const animations = {
  timing: {
    fast: 150,
    normal: 250,
    slow: 350,
  },
  easing: {
    ease: [0.25, 0.1, 0.25, 1],
    easeIn: [0.42, 0, 1, 1],
    easeOut: [0, 0, 0.58, 1],
    easeInOut: [0.42, 0, 0.58, 1],
  },
} as const;

/**
 * Component-specific style presets
 */
export const components = {
  button: {
    primary: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      borderRadius: borderRadius.xl,
      ...shadows.md,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      borderRadius: borderRadius.xl,
      ...shadows.sm,
    },
    ghost: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing['2xl'],
      borderRadius: borderRadius.xl,
    },
  },
  
  card: {
    default: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius['2xl'],
      padding: spacing['2xl'],
      ...shadows.md,
    },
    elevated: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: borderRadius['2xl'],
      padding: spacing['2xl'],
      ...shadows.lg,
    },
  },
  
  input: {
    default: {
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      fontSize: typography.sizes.base,
      color: colors.textPrimary,
    },
    focused: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
  },
} as const;

/**
 * Layout constants for consistent spacing
 */
export const layout = {
  screenPadding: spacing['2xl'],
  sectionSpacing: spacing['4xl'],
  itemSpacing: spacing.lg,
  borderWidth: 1.5,
} as const;

/**
 * Complete theme object
 */
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  gradients,
  animations,
  components,
  layout,
} as const;

/**
 * Type definitions for TypeScript support
 */
export type Theme = typeof theme;
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;