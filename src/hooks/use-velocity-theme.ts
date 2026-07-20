import { useTheme } from 'expo-router';
import { velocityDark, velocityLight } from '@/constants/theme';

export function useVelocityTheme() {
  const theme = useTheme();
  return theme.dark ? velocityDark : velocityLight;
}
