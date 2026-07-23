import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Camera, ChevronDown, ChevronUp, LogOut, Pencil, Plus, Settings, Shield, Trash2, UserRound, X } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { PageIntro, SectionLabel, StatCard } from '@/components/design';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import {
  createManagedTeam, createManagedUser, deleteManagedTeam, deleteManagedUser,
  fetchManagedMemberships, fetchManagedTeams, fetchManagedUsers, updateManagedTeam, updateManagedUser, uploadTeamLogo,
} from '@/services/admin';
import { useAuthStore } from '@/stores/auth-store';
import type { Profile, Team, UserRole } from '@/types/domain';
import { isStrongPassword, isValidEmail, isValidPhone, LIMITS, normalizePhone, PASSWORD_REQUIREMENTS } from '@/validations/auth';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

const emptyTeam = { name: '', tag: '', adminUserId: '', logoUri: '' };
const emptyUser = { name: '', nickname: '', email: '', phone: '', driverCode: '', password: '', teamIds: [] as string[], role: 'driver' as UserRole, accountStatus: 'active' as Profile['account_status'] };

export default function MasterAdminScreen() {
  const palette = useVelocityTheme();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const client = useQueryClient();
  const { data: teams = [], isLoading: loadingTeams } = useQuery({ queryKey: ['master-teams'], queryFn: fetchManagedTeams, enabled: Boolean(profile?.is_master_admin) });
  const { data: users = [], isLoading: loadingUsers } = useQuery({ queryKey: ['master-users'], queryFn: fetchManagedUsers, enabled: Boolean(profile?.is_master_admin) });
  const { data: memberships = [], isLoading: loadingMemberships } = useQuery({ queryKey: ['master-memberships'], queryFn: fetchManagedMemberships, enabled: Boolean(profile?.is_master_admin) });
  const [teamModal, setTeamModal] = useState(false); const [editingTeam, setEditingTeam] = useState<Team | null>(null); const [teamForm, setTeamForm] = useState(emptyTeam);
  const [userModal, setUserModal] = useState(false); const [editingUser, setEditingUser] = useState<Profile | null>(null); const [userForm, setUserForm] = useState(emptyUser);
  const [busy, setBusy] = useState(false);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [teamSearches, setTeamSearches] = useState<Record<string, string>>({});
  const regularUsers = useMemo(() => users.filter((item) => !item.is_master_admin), [users]);
  const usersByTeam = useMemo(() => {
    const grouped = new Map<string, Profile[]>();
    memberships.forEach((membership) => {
      const user = regularUsers.find((item) => item.id === membership.user_id);
      if (!user) return;
      const scopedUser = { ...user, role: membership.role, account_status: membership.status };
      grouped.set(membership.team_id, [...(grouped.get(membership.team_id) ?? []), scopedUser]);
    });
    regularUsers.filter((user) => !memberships.some((membership) => membership.user_id === user.id)).forEach((user) => grouped.set('without-team', [...(grouped.get('without-team') ?? []), user]));
    return grouped;
  }, [memberships, regularUsers]);

  if (!profile?.is_master_admin) return <Screen><AppText tone="danger">Acesso exclusivo do administrador master.</AppText></Screen>;
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: ['master-teams'] }), client.invalidateQueries({ queryKey: ['master-users'] }), client.invalidateQueries({ queryKey: ['master-memberships'] })]); };
  const closeTeam = () => { setTeamModal(false); setEditingTeam(null); setTeamForm(emptyTeam); };
  const openTeam = (team?: Team) => { setEditingTeam(team ?? null); setTeamForm(team ? { name: team.name, tag: team.tag, adminUserId: memberships.find((item) => item.team_id === team.id && item.role === 'admin' && item.status === 'active')?.user_id || '', logoUri: '' } : emptyTeam); setTeamModal(true); };
  const closeUser = () => { setUserModal(false); setEditingUser(null); setUserForm(emptyUser); };
  const toggleTeam = (teamId: string) => setExpandedTeams((current) => ({ ...current, [teamId]: !current[teamId] }));
  const setTeamSearch = (teamId: string, search: string) => setTeamSearches((current) => ({ ...current, [teamId]: search }));
  const openUser = (user?: Profile) => { setEditingUser(user ?? null); setUserForm(user ? { name: user.name, nickname: user.nickname || '', email: user.email, phone: user.phone || '', driverCode: user.driver_code || '', password: '', teamIds: memberships.filter((item) => item.user_id === user.id).map((item) => item.team_id), role: user.role, accountStatus: user.account_status } : emptyUser); setUserModal(true); };
  const pickLogo = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .8 }); if (!result.canceled) setTeamForm({ ...teamForm, logoUri: result.assets[0]!.uri }); };
  const saveTeam = async () => {
    if (!teamForm.name.trim() || !teamForm.tag.trim()) return Alert.alert('Preencha o nome e a tag da equipe.');
    if (teamForm.name.trim().length > LIMITS.teamName || teamForm.tag.trim().length > LIMITS.teamTag) return Alert.alert('Limite excedido', 'Revise o tamanho dos campos da equipe.');
    setBusy(true);
    try {
      let teamId = editingTeam?.id;
      if (editingTeam) await updateManagedTeam(editingTeam.id, { name: teamForm.name, tag: teamForm.tag }, teamForm.adminUserId || undefined);
      else { const result = await createManagedTeam({ name: teamForm.name, tag: teamForm.tag, adminUserId: teamForm.adminUserId || undefined }); teamId = result.team.id; }
      if (teamId && teamForm.logoUri) { const path = await uploadTeamLogo(teamId, teamForm.logoUri); await updateManagedTeam(teamId, { logo_url: path }); }
      closeTeam(); await refresh();
    } catch (error) { Alert.alert('Não foi possível salvar a equipe', error instanceof Error ? error.message : 'Revise os dados.'); } finally { setBusy(false); }
  };
  const saveUser = async () => {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.teamIds.length || (!editingUser && !userForm.password)) return Alert.alert('Preencha os dados obrigatórios e selecione ao menos uma equipe.');
    if (userForm.name.trim().length < 3 || userForm.name.trim().length > LIMITS.name || userForm.nickname.trim().length < 2 || userForm.nickname.trim().length > LIMITS.nickname) return Alert.alert('Nome ou apelido inválido', 'Revise o nome completo e o apelido.');
    if (!isValidEmail(userForm.email)) return Alert.alert('E-mail inválido', 'Informe um endereço de e-mail válido.');
    if (!isValidPhone(userForm.phone)) return Alert.alert('Telefone inválido', 'Informe um telefone com DDD.');
    if ((!editingUser || userForm.password) && !isStrongPassword(userForm.password)) return Alert.alert('Senha inválida', PASSWORD_REQUIREMENTS);
    setBusy(true);
    try {
      const normalized = { ...userForm, name: userForm.name.trim(), nickname: userForm.nickname.trim(), email: userForm.email.trim(), phone: normalizePhone(userForm.phone) };
      if (editingUser) await updateManagedUser(editingUser.id, { name: normalized.name, nickname: normalized.nickname, email: normalized.email, phone: normalized.phone, team_ids: normalized.teamIds, role: normalized.role, account_status: normalized.accountStatus, ...(normalized.password ? { password: normalized.password } : {}) });
      else await createManagedUser(normalized);
      closeUser(); await refresh();
    } catch (error) { Alert.alert('Não foi possível salvar o usuário', error instanceof Error ? error.message : 'Revise os dados.'); } finally { setBusy(false); }
  };
  const removeUser = (user: Profile) => Alert.alert('Excluir usuário?', `${user.name} perderá o acesso definitivamente.`, [{ text: 'Cancelar' }, { text: 'Excluir', style: 'destructive', onPress: async () => { setBusy(true); try { await deleteManagedUser(user.id); await refresh(); } catch (error) { Alert.alert('Falha ao excluir', error instanceof Error ? error.message : 'Tente novamente.'); } finally { setBusy(false); } } }]);
  const removeTeam = (team: Team) => Alert.alert('Excluir equipe?', 'O código, o logo, os vínculos e os dados desta equipe serão apagados. As contas dos membros continuarão ativas nos outros grupos.', [{ text: 'Cancelar' }, { text: 'Excluir', style: 'destructive', onPress: async () => { setBusy(true); try { await deleteManagedTeam(team.id); await refresh(); } catch (error) { Alert.alert('Falha ao excluir', error instanceof Error ? error.message : 'Tente novamente.'); } finally { setBusy(false); } } }]);
  const logout = async () => { await signOut(); router.replace('/(auth)/login'); };

  return <Screen scroll={false}><PageIntro eyebrow="Controle global" title="Administração master" subtitle="Gerencie equipes, administradores e usuários do MotoTrack." action={<View style={styles.headerActions}><Pressable accessibilityLabel="Configurações" style={[styles.headerButton, { backgroundColor: palette.cardHigh, borderColor: palette.border }]} onPress={() => router.push('/settings')}><Settings color={colors.amber} size={20}/></Pressable><Pressable accessibilityLabel="Sair" style={[styles.headerButton, { backgroundColor: palette.cardHigh, borderColor: palette.border }]} onPress={logout}><LogOut color={colors.red} size={20}/></Pressable></View>}/>
    <View style={styles.summary}><StatCard Icon={Building2} value={teams.length} label="equipes"/><StatCard Icon={UserRound} value={regularUsers.length} label="usuários"/></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.sectionTitle}><SectionLabel>EQUIPES E MEMBROS</SectionLabel><View style={styles.sectionActions}><Button title="Novo usuário" variant="outline" icon={<Plus size={17} color={colors.amber}/>} onPress={() => openUser()} style={styles.smallButton}/><Button title="Nova equipe" icon={<Plus size={17} color={colors.navy}/>} onPress={() => openTeam()} style={styles.smallButton}/></View></View>
      {loadingTeams || loadingUsers || loadingMemberships ? <AppText tone="muted">Carregando equipes e membros...</AppText> : teams.map((team) => {
        const members = usersByTeam.get(team.id) ?? [];
        const admins = members.filter((item) => item.role === 'admin');
        const expanded = Boolean(expandedTeams[team.id]);
        const search = teamSearches[team.id] ?? '';
        const visibleMembers = members.filter((member) => matchesUser(member, search));
        return <Card key={team.id} style={styles.teamGroup}>
          <View style={styles.itemTop}><Avatar uri={team.logo_url}/><View style={styles.grow}><AppText size={18} weight="800">{team.name}</AppText><AppText tone="muted" size={12}>{team.tag} · Código {team.join_code}</AppText><AppText tone="muted" size={12}>{members.length} {members.length === 1 ? 'membro' : 'membros'} · Admin: {admins.map((item) => item.name).join(', ') || 'não definido'}</AppText></View></View>
          <View style={[styles.actions, { borderTopColor: palette.border }]}><Action label="Editar equipe" Icon={Pencil} onPress={() => openTeam(team)}/><Action label="Excluir equipe" Icon={Trash2} danger onPress={() => removeTeam(team)}/><Action label={expanded ? 'Ocultar membros' : `Ver membros (${members.length})`} Icon={expanded ? ChevronUp : ChevronDown} onPress={() => toggleTeam(team.id)}/></View>
          {expanded ? <View style={[styles.membersArea, { borderTopColor: palette.border }]}><Field label={`Buscar em ${team.name}`} placeholder="Nome, apelido, e-mail ou ID" maxLength={80} value={search} onChangeText={(value) => setTeamSearch(team.id, value)}/><AppText tone="muted" size={12}>{visibleMembers.length} de {members.length} encontrados</AppText>{visibleMembers.length ? visibleMembers.map((member) => <MemberItem key={member.id} member={member} onEdit={() => openUser(member)} onDelete={() => removeUser(member)}/>) : <View style={styles.emptyMembers}><UserRound size={28} color={palette.muted}/><AppText tone="muted">Nenhum membro encontrado nesta equipe.</AppText></View>}</View> : null}
        </Card>;
      })}
      {(usersByTeam.get('without-team')?.length ?? 0) > 0 ? <Card style={styles.teamGroup}><View style={styles.itemTop}><View style={[styles.unassignedIcon, { backgroundColor: palette.overlay }]}><UserRound size={24} color={palette.muted}/></View><View style={styles.grow}><AppText size={18} weight="800">Sem equipe</AppText><AppText tone="muted" size={12}>{usersByTeam.get('without-team')!.length} usuários precisam ser vinculados</AppText></View></View>{usersByTeam.get('without-team')!.map((member) => <MemberItem key={member.id} member={member} onEdit={() => openUser(member)} onDelete={() => removeUser(member)}/>)}</Card> : null}
    </ScrollView>
    <Modal visible={teamModal} animationType="slide" transparent onRequestClose={closeTeam}><View style={styles.backdrop}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: palette.card, borderColor: palette.border, paddingBottom: spacing.lg + insets.bottom }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><ModalHeader title={editingTeam ? 'Editar equipe' : 'Nova equipe'} close={closeTeam}/><Pressable style={[styles.logoPicker, { backgroundColor: palette.overlay, borderColor: palette.border }]} onPress={pickLogo}>{teamForm.logoUri ? <Avatar uri={teamForm.logoUri} size={72}/> : <Camera size={28} color={colors.amber}/>}<AppText size={12} tone="muted">Selecionar logo</AppText></Pressable><Field label="Nome da equipe" placeholder="Ex.: Equipe Centro" maxLength={LIMITS.teamName} value={teamForm.name} onChangeText={(name) => setTeamForm({ ...teamForm, name })}/><Field label="Tag da equipe" placeholder="Ex.: CENTRO" maxLength={LIMITS.teamTag} autoCapitalize="characters" value={teamForm.tag} onChangeText={(tag) => setTeamForm({ ...teamForm, tag })}/>{editingTeam ? <Field label="Código automático da equipe" value={editingTeam.join_code} editable={false}/> : <AppText tone="muted" size={12}>O código exclusivo da equipe será gerado automaticamente ao salvar.</AppText>}<AppText weight="700">Administrador da equipe</AppText><ChoiceList values={regularUsers.map((item) => ({ id: item.id, label: `${item.name} · ID ${item.driver_code}` }))} selected={teamForm.adminUserId} onSelect={(adminUserId) => setTeamForm({ ...teamForm, adminUserId })}/><Button title="Salvar equipe" onPress={saveTeam} loading={busy}/></ScrollView></View></Modal>
    <Modal visible={userModal} animationType="slide" transparent onRequestClose={closeUser}><View style={styles.backdrop}><ScrollView contentContainerStyle={[styles.modal, { backgroundColor: palette.card, borderColor: palette.border, paddingBottom: spacing.lg + insets.bottom }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><ModalHeader title={editingUser ? 'Editar usuário' : 'Novo usuário'} close={closeUser}/><Field label="Nome" placeholder="Nome completo" maxLength={LIMITS.name} value={userForm.name} onChangeText={(name) => setUserForm({ ...userForm, name })}/><Field label="Apelido" placeholder="Como será exibido no mapa" maxLength={LIMITS.nickname} value={userForm.nickname} onChangeText={(nickname) => setUserForm({ ...userForm, nickname })}/><Field label="E-mail" placeholder="nome@empresa.com" maxLength={LIMITS.email} autoCapitalize="none" keyboardType="email-address" value={userForm.email} onChangeText={(email) => setUserForm({ ...userForm, email })}/><Field label="Telefone" placeholder="(11) 99999-9999" maxLength={LIMITS.phone} keyboardType="phone-pad" value={userForm.phone} onChangeText={(phone) => setUserForm({ ...userForm, phone })}/>{editingUser ? <Field label="ID do membro" value={userForm.driverCode} editable={false}/> : <AppText tone="muted" size={12}>O ID exclusivo será gerado automaticamente ao salvar.</AppText>}<Field label={editingUser ? 'Nova senha (opcional)' : 'Senha temporária'} placeholder="8 ou mais caracteres" maxLength={LIMITS.password} secureTextEntry value={userForm.password} onChangeText={(password) => setUserForm({ ...userForm, password })}/><AppText weight="700">Equipes</AppText><MultiChoiceList values={teams.map((team) => ({ id: team.id, label: team.name }))} selected={userForm.teamIds} onToggle={(teamId) => setUserForm({ ...userForm, teamIds: userForm.teamIds.includes(teamId) ? userForm.teamIds.filter((id) => id !== teamId) : [...userForm.teamIds, teamId] })}/><AppText weight="700">Função nas equipes selecionadas</AppText><ChoiceList values={[{ id: 'driver', label: 'Membro' }, { id: 'admin', label: 'Admin da equipe' }]} selected={userForm.role} onSelect={(role) => setUserForm({ ...userForm, role: role as UserRole })}/>{editingUser ? <><AppText weight="700">Status nas equipes</AppText><ChoiceList values={[{ id: 'active', label: 'Ativo' }, { id: 'inactive', label: 'Inativo' }, { id: 'pending', label: 'Pendente' }]} selected={userForm.accountStatus} onSelect={(accountStatus) => setUserForm({ ...userForm, accountStatus: accountStatus as Profile['account_status'] })}/></> : null}<Button title="Salvar usuário" onPress={saveUser} loading={busy}/></ScrollView></View></Modal>
  </Screen>;
}

function statusLabel(status: Profile['account_status']) { return status === 'active' ? 'Ativo' : status === 'pending' ? 'Pendente' : 'Inativo'; }
function matchesUser(user: Profile, search: string) { const query = search.trim().toLocaleLowerCase('pt-BR'); return !query || [user.name, user.nickname, user.driver_code, user.email].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query)); }
function ModalHeader({ title, close }: { title: string; close: () => void }) { const palette = useVelocityTheme(); return <View style={styles.modalHeader}><AppText size={21} weight="700">{title}</AppText><Pressable onPress={close} style={styles.closeButton}><X color={palette.text}/></Pressable></View>; }
function ChoiceList({ values, selected, onSelect }: { values: { id: string; label: string }[]; selected: string; onSelect: (id: string) => void }) { const palette = useVelocityTheme(); return <View style={styles.choices}>{values.length ? values.map((item) => <Pressable key={item.id} onPress={() => onSelect(item.id)} style={[styles.choice, { backgroundColor: palette.cardHigh, borderColor: palette.border }, selected === item.id && styles.choiceSelected]}><AppText size={13} weight="700" style={selected === item.id ? styles.choiceText : undefined}>{item.label}</AppText></Pressable>) : <AppText tone="muted" size={13}>Nenhuma opção disponível.</AppText>}</View>; }
function MultiChoiceList({ values, selected, onToggle }: { values: { id: string; label: string }[]; selected: string[]; onToggle: (id: string) => void }) { const palette = useVelocityTheme(); return <View style={styles.choices}>{values.length ? values.map((item) => { const active = selected.includes(item.id); return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => onToggle(item.id)} style={[styles.choice, { backgroundColor: palette.cardHigh, borderColor: palette.border }, active && styles.choiceSelected]}><AppText size={13} weight="700" style={active ? styles.choiceText : undefined}>{item.label}</AppText></Pressable>; }) : <AppText tone="muted" size={13}>Nenhuma opção disponível.</AppText>}</View>; }
function Action({ label, Icon, onPress, danger }: { label: string; Icon: typeof Shield; onPress: () => void; danger?: boolean }) { return <Pressable onPress={onPress} style={styles.action}><Icon size={18} color={danger ? colors.red : colors.amber}/><AppText size={11} tone={danger ? 'danger' : 'default'} style={!danger ? styles.actionText : undefined}>{label}</AppText></Pressable>; }
function MemberItem({ member, onEdit, onDelete }: { member: Profile; onEdit: () => void; onDelete: () => void }) { const palette = useVelocityTheme(); return <View style={[styles.memberItem, { backgroundColor: palette.cardHigh, borderColor: palette.border }]}><View style={styles.itemTop}><Avatar uri={member.avatar_url} size={42}/><View style={styles.grow}><AppText weight="800">{member.name}</AppText><AppText tone="muted" size={12}>@{member.nickname || member.name.split(' ')[0]} · ID {member.driver_code}</AppText><AppText tone="muted" size={12}>{member.email}</AppText><AppText tone="muted" size={12}>{member.role === 'admin' ? 'Admin da equipe' : 'Membro'} · {statusLabel(member.account_status)}</AppText></View></View><View style={[styles.memberActions, { borderTopColor: palette.border }]}><Action label="Editar" Icon={Pencil} onPress={onEdit}/><Action label="Excluir" Icon={Trash2} danger onPress={onDelete}/></View></View>; }

const styles = StyleSheet.create({ headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, headerButton: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, summary: { flexDirection: 'row', gap: spacing.md }, content: { gap: spacing.md, paddingBottom: 80 }, sectionTitle: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' }, sectionActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }, smallButton: { minHeight: 40, paddingHorizontal: spacing.md }, teamGroup: { gap: spacing.md }, itemTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, grow: { flex: 1, gap: 3 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.lg, borderTopWidth: 1, paddingTop: spacing.md }, action: { alignItems: 'center', gap: 3, minWidth: 60, maxWidth: 110 }, actionText: { color: colors.amber, textAlign: 'center' }, membersArea: { borderTopWidth: 1, paddingTop: spacing.md, gap: spacing.sm }, memberItem: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }, memberActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, borderTopWidth: 1, paddingTop: spacing.sm }, emptyMembers: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg }, unassignedIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#010810CC' }, modal: { borderWidth: 1, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '95%' }, modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, closeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, logoPicker: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minWidth: 96, minHeight: 96, borderRadius: radius.lg, borderWidth: 1 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, choice: { borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md }, choiceSelected: { backgroundColor: colors.amber, borderColor: colors.amber }, choiceText: { color: colors.navy } });
