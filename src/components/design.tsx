import type { PropsWithChildren, ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText, Card } from './ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={styles.intro}><View style={styles.introCopy}>{eyebrow ? <AppText size={12} weight="600" style={styles.eyebrow}>{eyebrow.toUpperCase()}</AppText> : null}<AppText size={26} weight="700" style={styles.title}>{title}</AppText>{subtitle ? <AppText tone="muted" size={14} style={styles.subtitle}>{subtitle}</AppText> : null}</View>{action}</View>;
}

export function SectionLabel({ children }: PropsWithChildren) {
  return <AppText size={12} weight="600" style={styles.sectionLabel}>{children}</AppText>;
}

export function IconTile({ Icon, color = colors.amber, size = 20 }: { Icon: LucideIcon; color?: string; size?: number }) {
  const palette = useVelocityTheme();
  return <View style={[styles.iconTile, { backgroundColor: palette.overlay }]}><Icon size={size} color={color}/></View>;
}

export function StatCard({ Icon, value, label, tone }: { Icon?: LucideIcon; value: string | number; label: string; tone?: 'default' | 'danger' | 'success' }) {
  return <Card style={styles.stat}>{Icon ? <IconTile Icon={Icon}/> : null}<AppText size={25} weight="700" tone={tone}>{value}</AppText><AppText tone="muted" size={12}>{label}</AppText></Card>;
}

export function SettingsRow({ Icon, title, subtitle, trailing, onPress, danger = false }: { Icon: LucideIcon; title: string; subtitle?: string; trailing?: ReactNode; onPress?: PressableProps['onPress']; danger?: boolean }) {
  const content = <><IconTile Icon={Icon} color={danger ? colors.red : colors.gray}/><View style={styles.rowCopy}><AppText weight="600" tone={danger ? 'danger' : 'default'}>{title}</AppText>{subtitle ? <AppText tone="muted" size={12} style={styles.rowSubtitle}>{subtitle}</AppText> : null}</View>{trailing}</>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [styles.settingsRow, pressed && styles.pressed]}>{content}</Pressable> : <View style={styles.settingsRow}>{content}</View>;
}

export function ActionIcon({ label, Icon, onPress, danger, disabled, style }: { label: string; Icon: LucideIcon; onPress: () => void; danger?: boolean; disabled?: boolean; style?: ViewStyle }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionIcon, style, (pressed || disabled) && styles.pressed]}><Icon size={19} color={danger ? colors.red : colors.amber}/><AppText size={10} weight="600" tone={danger ? 'danger' : 'default'} style={!danger ? styles.actionLabel : undefined}>{label.toUpperCase()}</AppText></Pressable>;
}

const styles = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  introCopy: { flex: 1, gap: 4 },
  eyebrow: { color: colors.amber, letterSpacing: .9 },
  title: { lineHeight: 33, letterSpacing: -.35 },
  subtitle: { lineHeight: 20, maxWidth: 560 },
  sectionLabel: { color: colors.gray, letterSpacing: 1, marginTop: spacing.sm },
  iconTile: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, minHeight: 120, gap: 5, justifyContent: 'space-between' },
  settingsRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowCopy: { flex: 1, gap: 3 },
  rowSubtitle: { lineHeight: 17 },
  actionIcon: { minWidth: 92, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { color: colors.amber, letterSpacing: .45 },
  pressed: { opacity: .58 },
});
