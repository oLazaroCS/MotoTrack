import { useMemo, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Check, Copy, Hash, Layers3, MapPin, Plus, Search, Users, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { PageIntro, SectionLabel } from '@/components/design';
import { AppText, Button, Card, Field, Screen, StatusDot } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { usePreciseUserLocation } from '@/hooks/use-precise-user-location';
import { useAllTeamDrivers, useTeamDrivers } from '@/hooks/use-team-drivers';
import { fetchMyTeams, fetchTeam, joinTeamByCode, setActiveTeam, type DriverAcrossTeams } from '@/services/drivers';
import { useAuthStore } from '@/stores/auth-store';
import { distanceKm, formatDistance, isStale, relativeTime } from '@/utils/format';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

type Filter = 'all' | 'online' | 'offline' | 'nearby' | 'name';
const filters: { key: Filter; label: string }[] = [{ key: 'all', label: 'Todos' }, { key: 'online', label: 'Online' }, { key: 'offline', label: 'Offline' }, { key: 'nearby', label: 'Mais próximos' }, { key: 'name', label: 'Nome' }];

export default function TeamScreen() {
  const palette = useVelocityTheme();
  const profile = useAuthStore((state) => state.profile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const { data: currentTeamData = [], isLoading: currentTeamLoading, error: currentTeamError } = useTeamDrivers(profile?.team_id ?? undefined);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAllTeams, setShowAllTeams] = useState(false);
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [changingTeam, setChangingTeam] = useState(false);
  const { data: team } = useQuery({ queryKey: ['team', profile?.team_id], queryFn: () => fetchTeam(profile!.team_id!), enabled: Boolean(profile?.team_id) });
  const { data: myTeamResults = [], refetch: refetchMyTeams } = useQuery({ queryKey: ['my-teams', profile?.id], queryFn: fetchMyTeams, enabled: Boolean(profile?.id) });
  const myTeams = useMemo(() => [...new Map(myTeamResults.map((membership) => [membership.team_id, membership])).values()], [myTeamResults]);
  const activeMyTeams = useMemo(() => myTeams.filter((membership) => membership.status === 'active'), [myTeams]);
  const activeTeamIds = useMemo(() => activeMyTeams.map((membership) => membership.team_id), [activeMyTeams]);
  const { data: allTeamData = [], isLoading: allTeamsLoading, error: allTeamsError } = useAllTeamDrivers(activeTeamIds, showAllTeams);
  const data = showAllTeams ? allTeamData : currentTeamData;
  const isLoading = showAllTeams ? allTeamsLoading : currentTeamLoading;
  const error = showAllTeams ? allTeamsError : currentTeamError;
  const visibleFilters = showAllTeams ? filters.filter((item) => item.key === 'online' || item.key === 'nearby' || item.key === 'name') : filters;
  const teamNameById = useMemo(() => new Map(myTeams.map((membership) => [membership.team_id, membership.team.name])), [myTeams]);
  const copyTeamCode = async () => { if (!team) return; await Clipboard.setStringAsync(team.join_code); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const synchronizedMe = data.find((item) => item.id === profile?.id)?.location;
  const me = usePreciseUserLocation(synchronizedMe);
  const switchTeam = async (teamId: string) => {
    setShowAllTeams(false);
    setFilter('all');
    if (teamId === profile?.team_id || changingTeam) return;
    setChangingTeam(true);
    try {
      await setActiveTeam(teamId);
      await refreshProfile();
    } catch (switchError) {
      Alert.alert('Não foi possível trocar de equipe', switchError instanceof Error ? switchError.message : 'Tente novamente.');
    } finally {
      setChangingTeam(false);
    }
  };
  const showEveryTeam = () => {
    setShowAllTeams(true);
    setFilter('online');
  };
  const joinAnotherTeam = async () => {
    if (joinCode.trim().length < 6) return Alert.alert('Código inválido', 'Cole o código completo da equipe.');
    setChangingTeam(true);
    try {
      await joinTeamByCode(joinCode.trim());
      await refetchMyTeams();
      setJoinCode('');
      setShowJoin(false);
      Alert.alert('Solicitação enviada', 'O administrador da nova equipe precisa aprovar sua entrada.');
    } catch (joinError) {
      Alert.alert('Não foi possível entrar na equipe', joinError instanceof Error ? joinError.message : 'Confira o código informado.');
    } finally {
      setChangingTeam(false);
    }
  };
  const drivers = useMemo(() => {
    const query = search.toLocaleLowerCase('pt-BR');
    const searched = data.filter((item) => [item.name, item.nickname, item.driver_code].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query)));
    const online = (item: typeof data[number]) => Boolean(item.location?.is_online && !isStale(item.location.updated_at, 15));
    const filtered = showAllTeams ? searched.filter(online) : filter === 'online' ? searched.filter(online) : filter === 'offline' ? searched.filter((item) => !online(item)) : searched;
    return [...filtered].sort((a, b) => filter === 'nearby' ? (distanceKm(me, a.location) ?? Infinity) - (distanceKm(me, b.location) ?? Infinity) : filter === 'name' ? a.name.localeCompare(b.name) : Number(online(b)) - Number(online(a)));
  }, [data, filter, me, search, showAllTeams]);
  const allTeamsOnlineCount = showAllTeams ? data.filter((item) => Boolean(item.location?.is_online && !isStale(item.location.updated_at, 15))).length : 0;
  const teamNamesFor = (driver: typeof data[number]) => {
    const teamIds = (driver as Partial<DriverAcrossTeams>).team_ids;
    return Array.isArray(teamIds) ? teamIds.map((teamId) => teamNameById.get(teamId)).filter((name): name is string => Boolean(name)) : [];
  };

  return <Screen>
    <PageIntro
      eyebrow="Operação"
      title={showAllTeams ? 'Todas as equipes' : team?.name || 'Equipe'}
      subtitle={showAllTeams ? `${allTeamsOnlineCount} integrantes online em ${activeMyTeams.length} equipes` : `${data.length} integrantes cadastrados`}
    />
    {myTeams.length > 1 ? <View style={styles.teamSelector}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.teamChoicesScroll}
        contentContainerStyle={styles.teamChoices}
      >
        <Pressable
          accessibilityLabel="Ver membros online de todas as equipes"
          onPress={showEveryTeam}
          style={[styles.teamChoice, { backgroundColor: palette.card, borderColor: showAllTeams ? colors.amber : palette.border }]}
        >
          <View style={[styles.allTeamsIcon, { backgroundColor: palette.overlay, borderColor: palette.border }]}>
            <Layers3 size={19} color={colors.amber}/>
          </View>
          <View style={styles.teamChoiceCopy}>
            <AppText size={12} weight="700" numberOfLines={1}>Todos os grupos</AppText>
            <AppText size={10} tone="success" numberOfLines={1}>Somente online</AppText>
          </View>
        </Pressable>
        {myTeams.map((membership) => {
          const active = !showAllTeams && membership.team_id === profile?.team_id;
          const pending = membership.status !== 'active';
          return <Pressable
            key={membership.team_id}
            disabled={pending || changingTeam}
            onPress={() => void switchTeam(membership.team_id)}
            style={[styles.teamChoice, { backgroundColor: palette.card, borderColor: active ? colors.amber : palette.border }, pending && styles.pendingChoice]}
          >
            <Avatar uri={membership.team.logo_url} size={34}/>
            <View style={styles.teamChoiceCopy}>
              <AppText size={12} weight="700" numberOfLines={1}>{membership.team.name}</AppText>
              {pending ? <AppText size={10} tone="muted" numberOfLines={1}>{membership.status === 'pending' ? 'Aguardando aprovação' : 'Inativa'}</AppText> : active ? <AppText size={10} tone="success" numberOfLines={1}>Equipe atual</AppText> : null}
            </View>
          </Pressable>;
        })}
      </ScrollView>
      <Pressable accessibilityLabel="Entrar em outra equipe" onPress={() => setShowJoin((visible) => !visible)} style={[styles.addTeamSingle, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {showJoin ? <X size={18} color={colors.amber}/> : <Plus size={18} color={colors.amber}/>}
        <AppText size={12} weight="700" style={styles.addTeamText}>{showJoin ? 'FECHAR' : 'ENTRAR EM OUTRA EQUIPE'}</AppText>
      </Pressable>
    </View> : <Pressable accessibilityLabel="Entrar em outra equipe" onPress={() => setShowJoin((visible) => !visible)} style={[styles.addTeamSingle, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {showJoin ? <X size={18} color={colors.amber}/> : <Plus size={18} color={colors.amber}/>}
      <AppText size={12} weight="700" style={styles.addTeamText}>{showJoin ? 'FECHAR' : 'ENTRAR EM OUTRA EQUIPE'}</AppText>
    </Pressable>}
    {showJoin ? <Card style={styles.joinCard}>
      <Field label="Código da nova equipe" placeholder="Ex.: EQP-A1B2C3D4E5" maxLength={64} autoCapitalize="characters" autoCorrect={false} value={joinCode} onChangeText={setJoinCode}/>
      <Button title="Solicitar entrada" loading={changingTeam} onPress={joinAnotherTeam}/>
    </Card> : null}
    {showAllTeams ? <Card style={styles.teamInfo}>
      <View style={[styles.allTeamsInfoIcon, { backgroundColor: palette.overlay, borderColor: palette.border }]}>
        <Layers3 size={22} color={colors.amber}/>
      </View>
      <View style={styles.codeCopy}>
        <AppText weight="700">Visão conjunta</AppText>
        <AppText tone="muted" size={12}>Mostrando uma única vez cada integrante online dos seus grupos.</AppText>
      </View>
    </Card> : team ? <Card style={styles.teamInfo}>
      <Avatar uri={team.logo_url} size={48}/>
      <View style={styles.teamCode}>
        <Hash size={17} color={colors.amber}/>
        <View style={styles.codeCopy}>
          <AppText tone="muted" size={11} weight="600" style={styles.codeLabel}>CÓDIGO DA EQUIPE</AppText>
          <AppText size={16} weight="700" style={styles.code} numberOfLines={1} ellipsizeMode="middle">{team.join_code}</AppText>
        </View>
      </View>
      <Pressable accessibilityLabel="Copiar código da equipe" onPress={copyTeamCode} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
        {copied ? <Check size={20} color={colors.greenBright}/> : <Copy size={20} color={colors.amber}/>}
        <AppText size={10} weight="600" tone={copied ? 'success' : 'default'} style={!copied ? styles.copyLabel : undefined}>{copied ? 'COPIADO' : 'COPIAR'}</AppText>
      </Pressable>
    </Card> : null}
    <View style={[styles.search, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Search size={19} color={palette.muted}/>
      <TextInput value={search} onChangeText={setSearch} placeholder="Buscar por nome, apelido ou ID" maxLength={80} placeholderTextColor={palette.muted} style={[styles.searchInput, { color: palette.text }]}/>
    </View>
    <View style={styles.filters}>{visibleFilters.map((item) => {
      const active = filter === item.key;
      return <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, { backgroundColor: palette.card, borderColor: palette.border }, active && styles.filterActive]}>
        <AppText size={13} weight="600" numberOfLines={1} style={active ? styles.filterTextActive : undefined}>{item.label}</AppText>
      </Pressable>;
    })}</View>
    <SectionLabel>{showAllTeams ? 'INTEGRANTES ONLINE' : 'INTEGRANTES'}</SectionLabel>
    <View style={styles.list}>
      {isLoading ? <AppText tone="muted">Carregando equipe...</AppText> : null}
      {error ? <AppText tone="danger">Não foi possível carregar a equipe.</AppText> : null}
      {!isLoading && !drivers.length ? <View style={styles.empty}>
        <Users size={36} color={colors.gray}/>
        <AppText weight="600">{showAllTeams ? 'Nenhum integrante online agora' : 'Nenhum integrante encontrado'}</AppText>
      </View> : drivers.map((driver) => {
        const online = Boolean(driver.location?.is_online && !isStale(driver.location.updated_at, 15));
        const distance = distanceKm(me, driver.location);
        const driverTeams = teamNamesFor(driver);
        return <Card key={driver.id} style={styles.driver}>
          <Pressable style={styles.driverMain} onPress={() => router.push({ pathname: '/driver/[id]', params: { id: driver.id } })}>
            <Avatar uri={driver.avatar_url}/>
            <View style={styles.driverCopy}>
              <AppText weight="600">{driver.name}</AppText>
              <AppText tone="muted" size={12}>@{driver.nickname || driver.name.split(' ')[0]} · ID {driver.driver_code}</AppText>
              {showAllTeams && driverTeams.length ? <AppText tone="muted" size={11} numberOfLines={1}>{driverTeams.join(' · ')}</AppText> : null}
              <View style={styles.status}>
                <StatusDot online={online}/>
                <AppText tone={online ? 'success' : 'muted'} size={12}>{online ? 'Online agora' : `Visto ${relativeTime(driver.location?.last_online_at ?? driver.location?.updated_at).toLowerCase()}`}</AppText>
              </View>
              {distance != null ? <AppText tone="muted" size={12}>{formatDistance(distance)} de você</AppText> : null}
            </View>
          </Pressable>
          <Button accessibilityLabel={`Ver ${driver.name} no mapa`} title="" variant="ghost" icon={<MapPin size={22} color={online ? colors.amber : colors.gray}/>} disabled={!online} onPress={() => router.push({ pathname: '/(tabs)/map', params: { driver: driver.id } })} style={styles.mapButton}/>
        </Card>;
      })}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  teamInfo: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  teamSelector: { gap: spacing.sm },
  teamChoicesScroll: { flexGrow: 0, minHeight: 64, maxHeight: 64 },
  teamChoices: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 1, paddingVertical: 1 },
  teamChoice: { width: 156, minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  teamChoiceCopy: { flex: 1, minWidth: 0 },
  allTeamsIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  allTeamsInfoIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pendingChoice: { opacity: .65 },
  addTeamSingle: { alignSelf: 'flex-start', minHeight: 42, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md },
  addTeamText: { color: colors.amber },
  joinCard: { gap: spacing.md },
  teamCode: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  codeCopy: { flex: 1 },
  codeLabel: { letterSpacing: .7 },
  code: { letterSpacing: 1.1 },
  copyButton: { minWidth: 62, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  copyLabel: { color: colors.amber, letterSpacing: .4 },
  pressed: { opacity: .6 },
  search: { height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderRadius: radius.md },
  searchInput: { flex: 1, height: '100%', paddingHorizontal: spacing.sm, fontSize: 15, fontFamily: fonts.regular },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filter: { minWidth: 96, flexGrow: 1, flexBasis: 96, height: 38, paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
