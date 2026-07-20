import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Shield, Trash2, UserCheck, Users } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { ActionIcon, PageIntro, SectionLabel, StatCard } from '@/components/design';
import { AppText, Card, Field, Screen, StatusDot } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useTeamDrivers } from '@/hooks/use-team-drivers';
import { deleteManagedUser, updateManagedUser } from '@/services/admin';
import { useAuthStore } from '@/stores/auth-store';
import type { DriverWithLocation } from '@/types/domain';
import { isStale, relativeTime } from '@/utils/format';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export default function AdminScreen() {
  const palette = useVelocityTheme();
  const profile = useAuthStore((state) => state.profile);
  const client = useQueryClient();
  const { data = [] } = useTeamDrivers(profile?.team_id ?? undefined);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  if (profile?.role !== 'admin' || profile.is_master_admin || !profile.team_id) return <Screen><AppText tone="danger">Acesso restrito ao administrador da equipe.</AppText></Screen>;
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const matches = (item: DriverWithLocation) => !query || [item.name, item.nickname, item.driver_code].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query));
  const allPending = data.filter((item) => item.account_status === 'pending');
  const allMembers = data.filter((item) => item.account_status !== 'pending');
  const pending = allPending.filter(matches);
  const members = allMembers.filter(matches);
  const refresh = () => client.invalidateQueries({ queryKey: ['drivers', profile.team_id] });
  const run = async (work: () => Promise<unknown>) => { setBusy(true); try { await work(); await refresh(); } catch (error) { Alert.alert('Operação não concluída', error instanceof Error ? error.message : 'Tente novamente.'); } finally { setBusy(false); } };
  const approve = (member: DriverWithLocation) => void run(() => updateManagedUser(member.id, { account_status: 'active' }));
  const toggleRole = (member: DriverWithLocation) => void run(() => updateManagedUser(member.id, { role: member.role === 'admin' ? 'driver' : 'admin' }));
  const expel = (member: DriverWithLocation) => Alert.alert('Expulsar membro?', `${member.name} perderá o acesso à equipe e precisará ser cadastrado novamente.`, [{ text: 'Cancelar' }, { text: 'Expulsar', style: 'destructive', onPress: () => void run(() => deleteManagedUser(member.id)) }]);

  return <Screen scroll={false}>
    <PageIntro eyebrow="Gestão do grupo" title="Administração da equipe" subtitle="Aprove solicitações e gerencie os administradores do grupo."/>
    <View style={styles.summary}><StatCard Icon={Users} value={allMembers.length} label="membros"/><StatCard Icon={UserCheck} value={allPending.length} label="aguardando" tone={allPending.length ? 'danger' : 'default'}/></View>
    <Field label="Buscar membro" placeholder="Nome, apelido ou ID" maxLength={80} value={search} onChangeText={setSearch}/>
    <ScrollView contentContainerStyle={styles.list}>
      {pending.length ? <SectionLabel>SOLICITAÇÕES PENDENTES</SectionLabel> : null}
      {pending.map((member) => <MemberCard key={member.id} member={member} borderColor={palette.border}><ActionIcon label="Aceitar" Icon={UserCheck} onPress={() => approve(member)} disabled={busy}/><ActionIcon label="Recusar" Icon={Trash2} danger onPress={() => expel(member)} disabled={busy}/></MemberCard>)}
      <SectionLabel>MEMBROS DA EQUIPE</SectionLabel>
      {members.map((member) => <MemberCard key={member.id} member={member} borderColor={palette.border}>{member.id !== profile.id ? <><ActionIcon label={member.role === 'admin' ? 'Remover admin' : 'Promover admin'} Icon={Shield} onPress={() => toggleRole(member)} disabled={busy}/><ActionIcon label="Expulsar" Icon={Trash2} danger onPress={() => expel(member)} disabled={busy}/></> : <AppText tone="muted" size={12} style={styles.own}>SUA CONTA</AppText>}</MemberCard>)}
    </ScrollView>
  </Screen>;
}

function MemberCard({ member, children, borderColor }: { member: DriverWithLocation; children: ReactNode; borderColor: string }) {
  const online = Boolean(member.location?.is_online && !isStale(member.location.updated_at, 2));
  return <Card style={styles.user}><View style={styles.userTop}><Avatar uri={member.avatar_url}/><View style={styles.copy}><AppText size={17} weight="600">{member.name}</AppText><AppText tone="muted" size={12}>@{member.nickname || member.name.split(' ')[0]} · ID {member.driver_code}</AppText><View style={styles.row}><StatusDot online={online}/><AppText tone="muted" size={12}>{member.role === 'admin' ? 'Admin da equipe' : 'Membro'} · {member.account_status === 'pending' ? 'Aguardando aprovação' : relativeTime(member.location?.updated_at)}</AppText></View></View></View><View style={[styles.actions, { borderTopColor: borderColor }]}>{children}</View></Card>;
}

const styles = StyleSheet.create({ summary: { flexDirection: 'row', gap: spacing.md }, list: { gap: spacing.sm, paddingBottom: 80 }, user: { gap: spacing.md }, userTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' }, copy: { flex: 1, gap: 4 }, row: { flexDirection: 'row', alignItems: 'center', gap: 6 }, actions: { minHeight: 58, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', borderTopWidth: 1, paddingTop: spacing.sm }, own: { textAlign: 'center', letterSpacing: .6 } });
