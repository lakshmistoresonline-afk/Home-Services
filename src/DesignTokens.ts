/**
 * Design Tokens for the Modernized Design System
 * Following Material 3 principles
 */

export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
};

export const animations = {
  duration: {
    fast: 150,
    standard: 300,
    slow: 500,
  },
  scale: {
    pressed: 0.98,
    hover: 1.02,
  },
};

export const typography = {
  display: {
    large: { fontSize: 57, lineHeight: 64, fontWeight: '400' },
    medium: { fontSize: 45, lineHeight: 52, fontWeight: '400' },
    small: { fontSize: 36, lineHeight: 44, fontWeight: '400' },
  },
  headline: {
    large: { fontSize: 32, lineHeight: 40, fontWeight: '400' },
    medium: { fontSize: 28, lineHeight: 36, fontWeight: '400' },
    small: { fontSize: 24, lineHeight: 32, fontWeight: '400' },
  },
  title: {
    large: { fontSize: 22, lineHeight: 28, fontWeight: '400' },
    medium: { fontSize: 16, lineHeight: 24, fontWeight: '500' },
    small: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  },
  body: {
    large: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    medium: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
    small: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  },
  label: {
    large: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
    medium: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
    small: { fontSize: 11, lineHeight: 16, fontWeight: '500' },
  },
};
