/**
 * Shopio design tokens (per `35-graphic-templates.md §3-6`)
 * 3-tier system: primitives → semantic → component
 */

export const colors = {
  brand: {
    primary: '#0066FF',
    primaryPressed: '#0052CC',
    primarySoft: '#E5F0FF',
    accent: '#FF6B35',
    ink: '#0A0A0A',
    paper: '#FAFAFA',
    inkDark: '#F4F4F5',
    paperDark: '#0A0A0A',
  },
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },
} as const;

export const spacing = {
  px: '1px',
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const radius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const motion = {
  fast: '150ms',
  base: '250ms',
  slow: '400ms',
  glacial: '600ms',
} as const;
