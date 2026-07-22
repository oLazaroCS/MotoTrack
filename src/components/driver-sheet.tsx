import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Crosshair, MessageCircle, Navigation, Phone, X } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from './avatar';
import { AppText, StatusDot } from './ui';
import { colors, spacing } from '@/constants/theme';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';
import type { DriverWithLocation } from '@/types/domain';
import { formatDistance, formatSpeed, isStale, relativeTime } from '@/utils/format';

type DriverSheetProps = {
  driver: DriverWithLocation;
  distance?: number | null;
  onCenter: () => void;
  onClose?: () => void;
};

export function DriverSheet({ driver, distance, onCenter, onClose }: DriverSheetProps) {
  const palette = useVelocityTheme();
  const location = driver.location!;
  const speed = formatSpeed(location.speed);
  const stale = isStale(location.updated_at);
  const phone = driver.phone?.replace(/\D/g, '') || '';
  const whatsAppPhone = phone.startsWith('55') ? phone : `55${phone}`;
  const actions = [
    { label: 'Ligar', Icon: Phone, action: () => Linking.openURL(`tel:${phone}`), disabled: !phone },
    { label: 'WhatsApp', Icon: MessageCircle, action: () => Linking.openURL(`https://wa.me/${whatsAppPhone}`), disabled: !phone },
    { label: 'Rota', Icon: Navigation, action: () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`) },
    { label: 'Centralizar', Icon: Crosshair, action: onCenter },
  ];

  return <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
    {onClose ? <Pressable accessibilityLabel="Fechar detalhes" hitSlop={10} onPress={onClose} style={styles.close}><X size={20} color={palette.muted}/></Pressable> : null}
    <Pressable style={styles.header} onPress={() => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })}>
      <Avatar uri={driver.avatar_url} size={54}/>
      <View style={styles.copy}>
        <AppText size={18} weight="800">{driver.name}</AppText>
        <AppText tone="muted" size={12}>@{driver.nickname || driver.name.split(' ')[0]} · ID {driver.driver_code || 'não definido'}</AppText>
        <View style={styles.row}><StatusDot online stale={stale}/><AppText size={13} tone={stale ? 'danger' : 'success'}>{stale ? `Atualizada ${relativeTime(location.updated_at).toLowerCase()}` : 'Online agora'}</AppText></View>
        <AppText tone="muted" size={12}>{speed ?? 'Velocidade indisponível'}{distance != null ? ` · ${formatDistance(distance)}` : ''}</AppText>
        <AppText tone="muted" size={12}>{driver.phone || 'Telefone não cadastrado'}</AppText>
      </View>
    </Pressable>
    <View style={[styles.actions, { borderTopColor: palette.border }]}>{actions.map(({ label, Icon, action, disabled }) => <Pressable key={label} disabled={disabled} onPress={action} style={[styles.action, disabled && styles.disabled]}><Icon size={20} color={colors.amber}/><AppText size={11} weight="700">{label}</AppText></Pressable>)}</View>
  </View>;
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md, maxWidth: 560, alignSelf: 'center', borderRadius: 12, borderWidth: 1, padding: spacing.md, gap: spacing.md, elevation: 8, shadowColor: '#000', shadowOpacity: .4, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
  close: { position: 'absolute', zIndex: 2, top: spacing.sm, right: spacing.sm, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', gap: spacing.md, paddingRight: spacing.lg },
  copy: { flex: 1, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: spacing.md },
  action: { width: 72, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 5 },
  disabled: { opacity: .35 },
});
