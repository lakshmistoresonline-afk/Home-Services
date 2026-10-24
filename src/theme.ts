import { useColorScheme } from 'react-native';
import { spacing, radius, shadows, typography, animations } from './DesignTokens';

const light = {
  background: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceTint: '#F3F4F6',
  primary: '#1E3A8A',
  primaryVariant: '#2563EB',
  text: '#0F172A',
  textSecondary: '#475569',
  border: '#E2E8F0',
  danger: '#DC2626',
  success: '#10B981',
  warning: '#F59E0B',
};

const dark = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceTint: '#334155',
  primary: '#3B82F6',
  primaryVariant: '#60A5FA',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  border: '#334155',
  danger: '#EF4444',
  success: '#34D399',
  warning: '#FBBF24',
};

export const statusColors = {
  Submitted: '#F59E0B',
  'In Progress': '#3B82F6',
  Resolved: '#10B981',
  Closed: '#64748B',
};

export type ThemeColors = typeof light;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? dark : light;

  return {
    colors,
    isDark,
    spacing,
    radius,
    shadows,
    typography,
    animations,
  };
}
