import { useState } from 'react';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Bell, Check, ChevronRight, LockKeyhole, Moon, ShieldCheck, Sun } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { PageIntro, SectionLabel, SettingsRow } from '@/components/design';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';
import { supabase } from '@/services/supabase';
import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
import { isStrongPassword, LIMITS, PASSWORD_REQUIREMENTS } from '@/validations/auth';

export default function SettingsScreen() {
  const appVersion = Constants.expoConfig?.version ?? '1.1.0';
  const [notifications, setNotifications] = useState(true);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const themeMode = useThemeStore((state) => state.mode);
  const setThemeMode = useThemeStore((state) => state.setMode);
  const palette = useVelocityTheme();

  const updatePassword = async () => {
    if (!isStrongPassword(password)) return Alert.alert('Senha inválida', PASSWORD_REQUIREMENTS);
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    Alert.alert(error ? 'Não foi possível alterar' : 'Senha alterada', error?.message);
    if (!error) setPassword('');
  };

  return <Screen>
    <PageIntro eyebrow="Preferências" title="Configurações" subtitle="Segurança, avisos e informações do aplicativo."/>
    <SectionLabel>APLICATIVO</SectionLabel>
    <Card style={styles.group}>
      <SettingsRow Icon={themeMode === 'dark' ? Moon : Sun} title="Aparência" subtitle={`Tema ${themeMode === 'dark' ? 'escuro' : 'claro'} ativo`}/>
      <View style={styles.themeChoices}>{(['light', 'dark'] as ThemeMode[]).map((mode) => {
        const active = themeMode === mode;
        const Icon = mode === 'light' ? Sun : Moon;
        return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => void setThemeMode(mode)} style={[styles.themeChoice, { backgroundColor: active ? colors.amberSoft : palette.overlay, borderColor: active ? colors.amber : palette.border }]}>
          <Icon size={19} color={active ? colors.amber : palette.muted}/>
          <AppText weight="600">{mode === 'light' ? 'Claro' : 'Escuro'}</AppText>
          {active ? <Check size={18} color={colors.amber}/> : null}
        </Pressable>;
      })}</View>
      <View style={[styles.divider, { backgroundColor: palette.border }]}/>
      <SettingsRow Icon={Bell} title="Avisos do aplicativo" subtitle="Conexão e compartilhamento" trailing={<Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: palette.overlay, true: '#17644F' }} thumbColor={notifications ? colors.greenBright : colors.gray}/>}/>
    </Card>
    <SectionLabel>SEGURANÇA</SectionLabel>
    <Card style={styles.group}><View style={styles.title}><LockKeyhole size={21} color={colors.amber}/><AppText size={18} weight="600">Alterar senha</AppText></View><Field label="Nova senha" placeholder="8 ou mais caracteres" maxLength={LIMITS.password} secureTextEntry value={password} onChangeText={setPassword}/><Button title="Atualizar senha" onPress={updatePassword} loading={saving}/></Card>
    <SectionLabel>GERAL</SectionLabel>
    <SettingsRow Icon={ShieldCheck} title="Política de privacidade" subtitle="Dados, localização e retenção" trailing={<ChevronRight size={19} color={colors.gray}/>} onPress={() => router.push('/privacy')}/>
    <AppText tone="muted" size={12} style={styles.version}>MotoTrack {appVersion}</AppText>
  </Screen>;
}

const styles = StyleSheet.create({
  group: { gap: spacing.md },
  divider: { height: 1 },
  themeChoices: { flexDirection: 'row', gap: spacing.sm },
  themeChoice: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  title: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  version: { textAlign: 'center', letterSpacing: .4, paddingVertical: spacing.lg },
});
