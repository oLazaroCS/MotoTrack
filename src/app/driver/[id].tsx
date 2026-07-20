import { useLocalSearchParams, router } from 'expo-router';
import { Gauge, LocateFixed, MessageCircle, Navigation, Phone, Timer } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { IconTile, SectionLabel } from '@/components/design';
import { Notice } from '@/components/notice';
import { AppText, Button, Card, Screen, StatusDot } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useTeamDrivers } from '@/hooks/use-team-drivers';
import { useAuthStore } from '@/stores/auth-store';
import { isStale, relativeTime } from '@/utils/format';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export default function DriverDetailsScreen() {
  const palette = useVelocityTheme();
  const { id } = useLocalSearchParams<{ id: string }>(); const profile = useAuthStore((state) => state.profile); const { data } = useTeamDrivers(profile?.team_id ?? undefined); const driver = data?.find((item) => item.id === id);
  if (!driver) return <Screen><AppText tone="muted">Carregando integrante...</AppText></Screen>;
  const location = driver.location; const stale = isStale(location?.updated_at); const phone = driver.phone?.replace(/\D/g, '') || ''; const whatsAppPhone = phone.startsWith('55') ? phone : `55${phone}`;
  return <Screen>
    <View style={styles.hero}><Avatar uri={driver.avatar_url} size={96}/><AppText size={25} weight="700">{driver.name}</AppText><AppText tone="muted" size={13}>@{driver.nickname || driver.name.split(' ')[0]} · ID {driver.driver_code || 'não definido'}</AppText><View style={styles.row}><StatusDot online={Boolean(location?.is_online)} stale={stale}/><AppText tone={location?.is_online ? 'success' : 'muted'} size={13}>{location?.is_online ? 'Online' : 'Offline'}</AppText></View><AppText tone="muted" size={13}>{driver.phone || 'Sem telefone'}</AppText></View>
    {stale && location ? <Notice type="warning" text={`Localização atualizada ${relativeTime(location.updated_at).toLowerCase()}.`}/> : null}
    <SectionLabel>TELEMETRIA</SectionLabel>
    <Card style={styles.details}><Detail Icon={Timer} label="Última atualização" value={relativeTime(location?.updated_at)}/><View style={[styles.divider, { backgroundColor: palette.border }]}/><Detail Icon={LocateFixed} label="Precisão" value={location?.accuracy ? `${location.accuracy.toFixed(0)} m` : 'Indisponível'}/><View style={[styles.divider, { backgroundColor: palette.border }]}/><Detail Icon={Gauge} label="Velocidade" value={location?.speed != null ? `${Math.max(0, location.speed * 3.6).toFixed(0)} km/h` : 'Indisponível'}/></Card>
    <SectionLabel>CONTATO E ROTA</SectionLabel>
    <View style={styles.actions}><Button title="Ligar" icon={<Phone size={18} color={colors.navy}/>} disabled={!phone} onPress={() => Linking.openURL(`tel:${phone}`)} style={styles.flex}/><Button title="WhatsApp" variant="outline" icon={<MessageCircle size={18} color={colors.amber}/>} disabled={!phone} onPress={() => Linking.openURL(`https://wa.me/${whatsAppPhone}`)} style={styles.flex}/></View>
    {location?.is_online ? <Button title="Traçar rota no mapa" icon={<Navigation size={18} color={colors.navy}/>} onPress={() => router.push({ pathname: '/(tabs)/map', params: { driver: driver.id } })}/> : null}
  </Screen>;
}
function Detail({ Icon, label, value }: { Icon: typeof Timer; label: string; value: string }) { return <View style={styles.detail}><IconTile Icon={Icon} color={colors.gray}/><View style={styles.detailCopy}><AppText tone="muted" size={12}>{label}</AppText><AppText weight="600">{value}</AppText></View></View>; }
const styles = StyleSheet.create({ hero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }, row: { flexDirection: 'row', alignItems: 'center', gap: 7 }, details: { gap: spacing.md }, divider: { height: 1 }, detail: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, detailCopy: { flex: 1, gap: 3 }, actions: { flexDirection: 'row', gap: spacing.md }, flex: { flex: 1 } });
