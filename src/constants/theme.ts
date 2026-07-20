import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

// Velocity Dark — tokens definidos em DESIGN (2).md.
export const colors = {
  navy: '#051424',
  navySoft: '#122131',
  amber: '#FFC107',
  amberSoft: '#3F350C',
  green: '#10B981',
  greenBright: '#34D399',
  red: '#FFB4AB',
  redBright: '#FFB4AB',
  gray: '#94A3B8',
  grayDark: '#D4C5AB',
  line: '#273647',
  light: '#051424',
  white: '#D4E4FA',
  ink: '#051424',
  stale: '#FABD00',
  darkBg: '#051424',
  darkCard: '#0D1C2D',
  darkCardHigh: '#122131',
  darkOverlay: '#1C2B3C',
  darkLine: '#273647',
  onSurface: '#D4E4FA',
  onSurfaceMuted: '#94A3B8',
};

export const velocityDark = {
  background: colors.darkBg,
  card: colors.darkCard,
  cardHigh: colors.darkCardHigh,
  overlay: colors.darkOverlay,
  border: colors.darkLine,
  text: colors.onSurface,
  muted: colors.gray,
};

export const velocityLight = {
  background: '#F4F6F8',
  card: '#FFFFFF',
  cardHigh: '#E9EEF3',
  overlay: '#E7ECF1',
  border: '#CED7E1',
  text: '#122131',
  muted: '#667085',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 40, xxl: 48 };
export const radius = { sm: 4, md: 8, lg: 12, xl: 16, full: 999 };
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
};

export const lightTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: { ...DefaultTheme.colors, primary: colors.amber, background: velocityLight.background, card: velocityLight.card, text: velocityLight.text, border: velocityLight.border, notification: colors.amber },
};

export const darkTheme: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: colors.amber, background: colors.darkBg, card: colors.darkCard, text: colors.onSurface, border: colors.darkLine, notification: colors.amber },
};
