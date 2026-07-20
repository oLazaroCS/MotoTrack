import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LocateFixed, Map, Radio, Users } from 'lucide-react-native';
import { Avatar } from '@/components/avatar';
import { Notice } from '@/components/notice';
import { AppText, Button, Card, Screen, StatusDot } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useTeamDrivers } from '@/hooks/use-team-drivers';
import { checkLocationReadiness, isTrackingRunning, startTracking, stopTracking } from '@/services/tracking';
import { useAuthStore } from '@/stores/auth-store';
import { useTrackingStore } from '@/stores/tracking-store';
import { isStale, relativeTime } from '@/utils/format';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';
import { useThemeStore } from '@/stores/theme-store';

export default function HomeScreen() {
  const palette = useVelocityTheme();
  const themeMode = useThemeStore((state) => state.mode);
  const profile = useAuthStore((state) => state.profile);
  const { data: drivers, refetch: refetchDrivers } = useTeamDrivers(profile?.team_id ?? undefined);
  const tracking = useTrackingStore();
  const setTracking = useTrackingStore((state) => state.setTracking);
  const storedLastSync = useTrackingStore((state) => state.lastSync);
  const [busy, setBusy] = useState(false);
  const own = drivers?.find((driver) => driver.id === profile?.id)?.location;
  const onlineCount = useMemo(() => drivers?.filter((driver) => driver.location?.is_online && !isStale(driver.location.updated_at, 15)).length ?? 0, [drivers]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const readiness = await checkLocationReadiness();
      let taskRunning = await isTrackingRunning();
      let resumedSync: string | null = null;
      if (Platform.OS === 'web' && own?.is_online && readiness.permission === 'granted' && !taskRunning) {
        try {
          resumedSync = await startTracking();
          taskRunning = true;
        } catch {
          taskRunning = false;
        }
      }
      if (!active) return;
      setTracking({
        isOnline: Boolean(own?.is_online && taskRunning),
        lastSync: resumedSync ?? own?.updated_at ?? storedLastSync,
        gpsEnabled: readiness.services,
        permission: readiness.permission === 'granted' ? 'granted' : readiness.permission === 'denied' ? 'denied' : 'undetermined',
      });
    })();
    return () => { active = false; };
  }, [own?.is_online, own?.updated_at, setTracking, storedLastSync]);

  const showMessage = (title: string, message: string) => {
    if (Platform.OS === 'web') globalThis.alert(`${title}\n\n${message}`);
    else Alert.alert(title, message);
  };

  const enableOnline = async () => {
    setBusy(true);
    try {
      const lastSync = await startTracking();
      tracking.setTracking({ isOnline: true, permission: 'granted', gpsEnabled: true, lastSync });
    } catch (error) {
      showMessage('Não foi possível ficar online', error instanceof Error ? error.message : 'Verifique as permissões do aparelho.');
    } finally {
      setBusy(false);
    }
  };

  const goOnline = () => {
    const message = `Enquanto estiver online, sua localização será compartilhada com os membros da sua equipe${Platform.OS === 'web' ? ' enquanto esta página estiver aberta.' : ', inclusive com o app em segundo plano.'}`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Compartilhar localização?\n\n${message}`)) void enableOnline();
      return;
    }
    Alert.alert('Compartilhar localização?', message, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ficar online', onPress: enableOnline },
    ]);
  };

  const goOffline = async () => {
    setBusy(true);
    try {
      await stopTracking();
      tracking.setTracking({ isOnline: false });
      await refetchDrivers();
    } catch (error) {
      const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
      showMessage('Falha ao encerrar', message);
    } finally {
      setBusy(false);
    }
  };

  const firstName = profile?.name?.split(' ')[0] || 'Motociclista';

  return <Screen style={styles.screen}>
    <View style={styles.brandHeader}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Image source={require('../../../assets/icon.png')} contentFit="cover" style={styles.brandLogo}/></View>
        <View><AppText size={12} weight="600" style={styles.eyebrow}>CENTRAL DE OPERAÇÕES</AppText><AppText size={20} weight="800">MotoTrack</AppText></View>
      </View>
      <Avatar uri={profile?.avatar_url} size={44}/>
    </View>

    <View style={styles.welcomeRow}>
      <View style={styles.welcomeCopy}><AppText tone="muted" size={14}>Bom trabalho,</AppText><AppText size={24} weight="700" style={styles.headline}>{firstName}</AppText></View>
      <View style={[styles.onlineChip, { backgroundColor: palette.cardHigh, borderColor: palette.border }]}><StatusDot online={onlineCount > 0}/><AppText size={12} weight="600" style={styles.chipLabel}>{onlineCount} ONLINE</AppText></View>
    </View>

    {!tracking.isConnected ? <Notice type="internet" text="Sem internet. A última posição será reenviada quando a conexão voltar."/> : null}
    {tracking.gpsEnabled === false ? <Notice type="gps" text={Platform.OS === 'web' ? 'Localização indisponível. Abra o site por HTTPS ou localhost e permita a localização no navegador.' : 'GPS desativado. Ative a localização do aparelho para ficar online.'}/> : null}
    {tracking.permission === 'denied' ? <Notice type="permission" text={Platform.OS === 'web' ? 'A localização foi bloqueada. Libere-a no ícone ao lado do endereço do site.' : 'A permissão de localização foi negada. Libere-a nas configurações do Android.'}/> : null}

    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tracking.isOnline ? 'Encerrar compartilhamento de localização' : 'Iniciar compartilhamento de localização'}
      onPress={tracking.isOnline ? goOffline : goOnline}
      disabled={busy}
      style={({ pressed }) => [styles.statusCard, { backgroundColor: palette.card, borderColor: palette.border }, tracking.isOnline && (themeMode === 'dark' ? styles.statusCardOnline : styles.statusCardOnlineLight), (pressed || busy) && styles.pressed]}
    >
      <View style={styles.statusTop}>
        <View style={[styles.signal, { backgroundColor: palette.overlay, borderColor: palette.border }, tracking.isOnline && (themeMode === 'dark' ? styles.signalOnline : styles.signalOnlineLight)]}><Radio size={28} color={tracking.isOnline ? colors.green : colors.amber}/></View>
        <View style={[styles.stateChip, { backgroundColor: palette.overlay }, tracking.isOnline && (themeMode === 'dark' ? styles.stateChipOnline : styles.stateChipOnlineLight)]}><StatusDot online={tracking.isOnline}/><AppText size={12} weight="600" style={tracking.isOnline ? styles.onlineText : styles.offlineText}>{tracking.isOnline ? 'RASTREAMENTO ATIVO' : 'RASTREAMENTO PAUSADO'}</AppText></View>
      </View>
      <View style={styles.statusCopyWrap}>
        <AppText size={24} weight="700" style={styles.statusTitle}>{tracking.isOnline ? 'Você está online' : 'Você está offline'}</AppText>
        <AppText tone="muted" size={14} style={styles.statusCopy}>{tracking.isOnline ? 'Sua posição está sendo atualizada para os integrantes da equipe em tempo real.' : 'Ative o rastreamento para compartilhar sua posição com a equipe.'}</AppText>
      </View>
      <View style={[styles.statusAction, tracking.isOnline && [styles.statusActionOnline, { backgroundColor: palette.overlay, borderColor: palette.border }]]}><AppText weight="700" style={tracking.isOnline ? [styles.statusActionOnlineText, { color: palette.text }] : styles.statusActionText}>{busy ? 'AGUARDE...' : tracking.isOnline ? 'FICAR OFFLINE' : 'FICAR ONLINE'}</AppText></View>
    </Pressable>

    <AppText size={12} weight="600" style={styles.sectionLabel}>VISÃO GERAL</AppText>
    <View style={styles.metrics}>
      <Card style={styles.metric}>
        <View style={[styles.metricIcon, { backgroundColor: palette.overlay }]}><Users size={21} color={colors.amber}/></View>
        <AppText size={26} weight="700">{onlineCount}</AppText>
        <AppText tone="muted" size={12} style={styles.metricLabel}>integrantes online</AppText>
      </Card>
      <Card style={styles.metric}>
        <View style={[styles.metricIcon, { backgroundColor: palette.overlay }]}><LocateFixed size={21} color={colors.amber}/></View>
        <AppText size={17} weight="700" numberOfLines={1}>{relativeTime(tracking.lastSync)}</AppText>
        <AppText tone="muted" size={12} style={styles.metricLabel}>última sincronização</AppText>
      </Card>
    </View>

    <Button title="Abrir mapa da equipe" variant="accent" icon={<Map size={20} color={colors.navy}/>} onPress={() => router.push('/(tabs)/map')}/>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  brandHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.amber, overflow: 'hidden' },
  brandLogo: { width: '100%', height: '100%' },
  eyebrow: { color: colors.amber, letterSpacing: .8, lineHeight: 16 },
  welcomeRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md, paddingTop: spacing.sm },
  welcomeCopy: { flex: 1, gap: 2 },
  headline: { letterSpacing: -.3, lineHeight: 32 },
  onlineChip: { height: 30, paddingHorizontal: 12, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  chipLabel: { letterSpacing: .55 },
  statusCard: { minHeight: 280, borderRadius: radius.xl, borderWidth: 1, padding: spacing.md, justifyContent: 'space-between', gap: spacing.lg },
  statusCardOnline: { borderColor: '#1D735C', backgroundColor: '#0A2526' },
  statusCardOnlineLight: { borderColor: '#75C5AC', backgroundColor: '#E7F7F1' },
  pressed: { opacity: .78 },
  statusTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  signal: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  signalOnline: { backgroundColor: '#0B372F', borderColor: '#17644F' },
  signalOnlineLight: { backgroundColor: '#D4F2E7', borderColor: '#75C5AC' },
  stateChip: { minHeight: 28, paddingHorizontal: 10, borderRadius: radius.full, flexDirection: 'row', alignItems: 'center', gap: 7 },
  stateChipOnline: { backgroundColor: '#0D3B31' },
  stateChipOnlineLight: { backgroundColor: '#D4F2E7' },
  offlineText: { color: colors.gray, letterSpacing: .45 },
  onlineText: { color: colors.greenBright, letterSpacing: .45 },
  statusCopyWrap: { gap: spacing.sm },
  statusTitle: { letterSpacing: -.35, lineHeight: 32 },
  statusCopy: { maxWidth: 460, lineHeight: 21 },
  statusAction: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  statusActionOnline: { borderWidth: 1 },
  statusActionText: { color: colors.navy, letterSpacing: .35 },
  statusActionOnlineText: { letterSpacing: .35 },
  sectionLabel: { color: colors.gray, letterSpacing: 1, marginTop: spacing.sm },
  metrics: { flexDirection: 'row', gap: spacing.md },
  metric: { flex: 1, minHeight: 132, gap: 6, justifyContent: 'space-between' },
  metricIcon: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  metricLabel: { lineHeight: 17 },
});
