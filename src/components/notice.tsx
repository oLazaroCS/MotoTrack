import { AlertTriangle, WifiOff, MapPinOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { AppText } from './ui';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export function Notice({ type, text }: { type: 'internet' | 'gps' | 'permission' | 'warning'; text: string }) {
  const palette = useVelocityTheme();
  const Icon = type === 'internet' ? WifiOff : type === 'permission' ? MapPinOff : AlertTriangle;
  return <View style={[styles.wrap, { backgroundColor: palette.card, borderColor: colors.red }]}><Icon size={20} color={colors.red}/><AppText size={13} style={styles.text}>{text}</AppText></View>;
}
const styles = StyleSheet.create({ wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1 }, text: { flex: 1, lineHeight: 19 } });
