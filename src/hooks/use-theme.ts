/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemeContext } from '@/context/theme-context';

export function useTheme() {
  const { resolvedTheme } = useThemeContext();
  return Colors[resolvedTheme];
}
