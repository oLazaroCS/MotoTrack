import { useState } from 'react';
import { router } from 'expo-router';
import { Clock3, LogOut, RefreshCw } from 'lucide-react-native';
import { View, StyleSheet } from 'react-native';
import { PageIntro } from '@/components/design';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth-store';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export default function PendingScreen() {
  const palette = useVelocityTheme();
  const profile = useAuthStore((state) => state.profile); const refreshProfile = useAuthStore((state) => state.refreshProfile); const signOut = useAuthStore((state) => state.signOut); const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(true); await refreshProfile(); setBusy(false); const current = useAuthStore.getState().profile; if (current?.account_status === 'active') router.replace((current.is_master_admin ? '/master-admin' : '/(tabs)') as never); };
  const logout = async () => { await signOut(); router.replace('/(auth)/login'); };
  const inactive = profile?.account_status === 'inactive';
  return <Screen style={styles.screen}><View style={[styles.icon, { backgroundColor: palette.overlay, borderColor: palette.border }]}><Clock3 size={38} color={inactive ? colors.red : colors.amber}/></View><PageIntro eyebrow={inactive ? 'Acesso indisponível' : 'Cadastro recebido'} title={inactive ? 'Acesso suspenso' : 'Aguardando aprovação'} subtitle={inactive ? 'O administrador da sua equipe suspendeu este acesso.' : 'Seu cadastro foi enviado ao administrador da equipe. Você poderá acessar o mapa e compartilhar sua localização após a aprovação.'}/><Card style={styles.card}><AppText tone="muted" style={styles.center}>{inactive ? 'Entre em contato com o administrador responsável para revisar sua situação.' : 'Você não precisa criar outra conta. Use o botão abaixo para consultar novamente o status do cadastro.'}</AppText></Card><Button title="Verificar novamente" icon={<RefreshCw size={18} color={colors.navy}/>} onPress={refresh} loading={busy}/><Button title="Sair" variant="ghost" icon={<LogOut size={18} color={colors.red}/>} onPress={logout}/></Screen>;
}
const styles = StyleSheet.create({ screen: { justifyContent: 'center', maxWidth: 520 }, icon: { width: 76, height: 76, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, card: { maxWidth: 520 }, center: { lineHeight: 22 }, });
