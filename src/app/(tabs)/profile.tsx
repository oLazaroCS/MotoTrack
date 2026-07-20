import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, LogOut, Settings, Shield } from 'lucide-react-native';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { PageIntro, SectionLabel } from '@/components/design';
import { AppText, Button, Card, Field, Screen, StatusDot } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { updateProfile, uploadAvatar } from '@/services/drivers';
import { stopTracking } from '@/services/tracking';
import { useAuthStore } from '@/stores/auth-store';
import { useTrackingStore } from '@/stores/tracking-store';
import { LIMITS, normalizePhone, profileSchema } from '@/validations/auth';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export default function ProfileScreen() {
  const palette = useVelocityTheme();
  const profile = useAuthStore((state) => state.profile);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const signOut = useAuthStore((state) => state.signOut);
  const isOnline = useTrackingStore((state) => state.isOnline);
  const [name, setName] = useState(profile?.name || '');
  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  if (!profile) return <Screen><AppText>Carregando perfil...</AppText></Screen>;

  const save = async () => { const parsed = profileSchema.safeParse({ name, nickname, phone }); if (!parsed.success) return Alert.alert('Revise os dados', parsed.error.issues[0]?.message); setSaving(true); try { await updateProfile(profile.id, { name: parsed.data.name, nickname: parsed.data.nickname, phone: normalizePhone(parsed.data.phone) }); await refreshProfile(); Alert.alert('Perfil atualizado'); } catch (error) { Alert.alert('Não foi possível salvar', error instanceof Error ? error.message : 'Tente novamente.'); } finally { setSaving(false); } };
  const pickPhoto = async () => { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .75 }); if (result.canceled) return; setSaving(true); try { const url = await uploadAvatar(profile.id, result.assets[0]!.uri); await updateProfile(profile.id, { avatar_url: url }); await refreshProfile(); } catch (error) { Alert.alert('Falha no envio', error instanceof Error ? error.message : 'Tente novamente.'); } finally { setSaving(false); } };
  const performLogout = async () => {
    setLoggingOut(true);
    try {
      if (isOnline) await stopTracking();
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Tente novamente.';
      if (Platform.OS === 'web') globalThis.alert(`Não foi possível sair\n\n${message}`);
      else Alert.alert('Não foi possível sair', message);
    } finally { setLoggingOut(false); }
  };
  const logout = () => {
    const message = isOnline ? 'O rastreamento será encerrado antes de sair.' : 'Você precisará entrar novamente.';
    if (Platform.OS === 'web') { if (globalThis.confirm(`Sair da conta?\n\n${message}`)) void performLogout(); return; }
    Alert.alert('Sair da conta?', message, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: performLogout }]);
  };

  return <Screen>
    <PageIntro eyebrow="Minha conta" title="Perfil" subtitle="Gerencie sua identificação e seus dados de contato."/>
    <View style={styles.profile}><Pressable accessibilityLabel="Alterar foto do perfil" onPress={pickPhoto} style={styles.avatarButton}><Avatar uri={profile.avatar_url} size={112}/><View style={[styles.camera, { borderColor: palette.background }]}><Camera size={18} color={colors.navy}/></View></Pressable><AppText size={26} weight="700">{profile.name}</AppText><AppText tone="muted" size={14}>@{profile.nickname || profile.name.split(' ')[0]}</AppText><View style={styles.row}><StatusDot online={isOnline}/><AppText tone={isOnline ? 'success' : 'muted'} size={13}>{isOnline ? 'Online' : 'Offline'}</AppText></View><View style={[styles.idChip, { backgroundColor: palette.card, borderColor: palette.border }]}><AppText tone="muted" size={12} weight="600">ID {profile.driver_code || '—'}</AppText></View></View>
    <SectionLabel>DADOS PESSOAIS</SectionLabel>
    <Card style={styles.form}><Field label="Nome completo" placeholder="Ex.: Maria Silva" maxLength={LIMITS.name} value={name} onChangeText={setName}/><Field label="Apelido" placeholder="Ex.: Mari" maxLength={LIMITS.nickname} value={nickname} onChangeText={setNickname}/><Field label="Telefone" placeholder="(11) 99999-9999" maxLength={LIMITS.phone} value={phone} keyboardType="phone-pad" onChangeText={setPhone}/><Field label="E-mail" maxLength={LIMITS.email} value={profile.email} editable={false}/><Button title="Salvar alterações" variant="outline" onPress={save} loading={saving}/></Card>
    <SectionLabel>ACESSOS</SectionLabel>
    {profile.role === 'admin' && !profile.is_master_admin ? <Button title="Painel administrativo da equipe" icon={<Shield size={19} color={colors.navy}/>} onPress={() => router.push('/admin')}/> : null}
    <Button title="Configurações" variant="outline" icon={<Settings size={19} color={colors.amber}/>} onPress={() => router.push('/settings')}/>
    <Button title="Sair da conta" variant="ghost" icon={<LogOut size={19} color={colors.red}/>} onPress={logout} loading={loggingOut}/>
  </Screen>;
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  avatarButton: { padding: spacing.xs },
  camera: { position: 'absolute', right: 1, bottom: 1, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  idChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  form: { gap: spacing.md },
});
