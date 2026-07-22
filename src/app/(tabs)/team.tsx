import { useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, Copy, Hash, MapPin, Search, Users } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { PageIntro, SectionLabel } from '@/components/design';
import { AppText, Button, Card, Screen, StatusDot } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { usePreciseUserLocation } from '@/hooks/use-precise-user-location';
import { useTeamDrivers } from '@/hooks/use-team-drivers';
import { fetchTeam } from '@/services/drivers';
import { useAuthStore } from '@/stores/auth-store';
import { distanceKm, formatDistance, isStale, relativeTime } from '@/utils/format';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

type Filter = 'all' | 'online' | 'offline' | 'nearby' | 'name';
const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'Todos' }, { key: 'online', label: 'Online' }, { key: 'offline', label: 'Offline' }, { key: 'nearby', label: 'Mais próximos' }, { key: 'name', label: 'Nome' }];

export default function TeamScreen() {
  const palette = useVelocityTheme();
  const profile = useAuthStore((state) => state.profile);
  const { data = [], isLoading, error } = useTeamDrivers(profile?.team_id ?? undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const { data: team } = useQuery({ queryKey: ['team', profile?.team_id], queryFn: () => fetchTeam(profile!.team_id!), enabled: Boolean(profile?.team_id) });
  const copyTeamCode = async () => { if (!team) return; await Clipboard.setStringAsync(team.join_code); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const synchronizedMe = data.find((item) => item.id === profile?.id)?.location;
  const me = usePreciseUserLocation(synchronizedMe);
  const drivers = useMemo(() => {
    const query = search.toLocaleLowerCase('pt-BR');
    const searched = data.filter((item) => [item.name, item.nickname, item.driver_code].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query)));
    const online = (item: typeof data[number]) => Boolean(item.location?.is_online && !isStale(item.location.updated_at, 15));
    const filtered = filter === 'online' ? searched.filter(online) : filter === 'offline' ? searched.filter((item) => !online(item)) : searched;
    return [...filtered].sort((a, b) => filter === 'nearby' ? (distanceKm(me, a.location) ?? Infinity) - (distanceKm(me, b.location) ?? Infinity) : filter === 'name' ? a.name.localeCompare(b.name) : Number(online(b)) - Number(online(a)));
  }, [data, filter, me, search]);

  return <Screen scroll={false}>
    <PageIntro eyebrow="Operação" title={team?.name || 'Equipe'} subtitle={`${data.length} integrantes cadastrados`}/>
    {team ? <Card style={styles.teamInfo}><Avatar uri={team.logo_url} size={44}/><View style={styles.teamCode}><Hash size={17} color={colors.amber}/><View style={styles.codeCopy}><AppText tone="muted" size={11} weight="600" style={styles.codeLabel}>CÓDIGO DA EQUIPE</AppText><AppText size={16} weight="700" style={styles.code} numberOfLines={1} ellipsizeMode="middle">{team.join_code}</AppText></View></View><Pressable accessibilityLabel="Copiar código da equipe" onPress={copyTeamCode} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>{copied ? <Check size={20} color={colors.greenBright}/> : <Copy size={20} color={colors.amber}/>}<AppText size={10} weight="600" tone={copied ? 'success' : 'default'} style={!copied ? styles.copyLabel : undefined}>{copied ? 'COPIADO' : 'COPIAR'}</AppText></Pressable></Card> : null}
    <View style={[styles.search, { backgroundColor: palette.card, borderColor: palette.border }]}><Search size={19} color={palette.muted}/><TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nome, apelido ou ID" maxLength={80} placeholderTextColor={palette.muted} style={[styles.searchInput, { color: palette.text }]}/></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => { const active = filter === item.key; return <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, { backgroundColor: palette.card, borderColor: palette.border }, active && styles.filterActive]}><AppText size={13} weight="600" style={active ? styles.filterTextActive : undefined}>{item.label}</AppText></Pressable>; })}</ScrollView>
    <SectionLabel>INTEGRANTES</SectionLabel>
    <ScrollView contentContainerStyle={styles.list}>{isLoading ? <AppText tone="muted">Carregando equipe...</AppText> : null}{error ? <AppText tone="danger">Não foi possível carregar a equipe.</AppText> : null}{!isLoading && !drivers.length ? <View style={styles.empty}><Users size={36} color={colors.gray}/><AppText weight="600">Nenhum integrante encontrado</AppText></View> : drivers.map((driver) => { const online = Boolean(driver.location?.is_online && !isStale(driver.location.updated_at, 15)); const distance = distanceKm(me, driver.location); return <Card key={driver.id} style={styles.driver}><Pressable style={styles.driverMain} onPress={() => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })}><Avatar uri={driver.avatar_url}/><View style={styles.driverCopy}><AppText weight="600">{driver.name}</AppText><AppText tone="muted" size={12}>@{driver.nickname || driver.name.split(' ')[0]} · ID {driver.driver_code}</AppText><View style={styles.status}><StatusDot online={online}/><AppText tone={online ? 'success' : 'muted'} size={12}>{online ? 'Online agora' : `Visto ${relativeTime(driver.location?.last_online_at ?? driver.location?.updated_at).toLowerCase()}`}</AppText></View>{distance != null ? <AppText tone="muted" size={12}>{formatDistance(distance)} de você</AppText> : null}</View></Pressable><Button accessibilityLabel={`Ver ${driver.name} no mapa`} title="" variant="ghost" icon={<MapPin size={22} color={online ? colors.amber : colors.gray}/>} disabled={!online} onPress={() => router.push({ pathname: '/(tabs)/map', params: { driver: driver.id } })} style={styles.mapButton}/></Card>; })}</ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  teamInfo: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  teamCode: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  codeCopy: { flex: 1 },
  codeLabel: { letterSpacing: .7 },
  code: { letterSpacing: 1.1 },
  copyButton: { minWidth: 62, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  copyLabel: { color: colors.amber, letterSpacing: .4 },
  pressed: { opacity: .6 },
  search: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.md },
  searchInput: { flex: 1, height: '100%', paddingHorizontal: spacing.sm, fontSize: 15, fontFamily: fonts.regular },
  filters: { gap: spacing.sm },
  filter: { height: 36, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.amber, borderColor: colors.amber },
  filterTextActive: { color: colors.navy },
  list: { gap: spacing.sm, paddingBottom: 110 },
  driver: { flexDirection: 'row', padding: spacing.md, alignItems: 'center' },
  driverMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  driverCopy: { flex: 1, gap: 4 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapButton: { width: 44, minHeight: 44, paddingHorizontal: 0 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
});
