import { useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Camera, Map, type CameraRef } from '@maplibre/maplibre-react-native';
import { Crosshair, Users } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { AnimatedDriverMarker } from '@/components/animated-driver-marker';
import { DriverSheet } from '@/components/driver-sheet';
import { AppText, Button } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { MAP_STYLE_URL } from '@/constants/map-style';
import { useTeamDrivers } from '@/hooks/use-team-drivers';
import { useAuthStore } from '@/stores/auth-store';
import type { DriverWithLocation } from '@/types/domain';
import { distanceKm, isStale } from '@/utils/format';

export default function TeamMapScreen() {
  const camera = useRef<CameraRef>(null); const handledDriver = useRef<string | null>(null); const framedTeam = useRef(false); const { driver: driverId } = useLocalSearchParams<{ driver?: string }>(); const profile = useAuthStore((s) => s.profile); const { data, isLoading, error } = useTeamDrivers(profile?.team_id ?? undefined); const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined); const [mapReady, setMapReady] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);
  const online = useMemo(() => data?.filter((driver) => driver.location?.is_online && !isStale(driver.location.updated_at, 2)) ?? [], [data]);
  const me = data?.find((driver) => driver.id === profile?.id)?.location;
  const selected = online.find((driver) => driver.id === (selectedId === undefined ? driverId : selectedId)) ?? null;
  const center = (driver: DriverWithLocation) => { const location = driver.location!; camera.current?.easeTo({ center: [location.longitude, location.latitude], zoom: 16, duration: 550 }); };
  const follow = (driver: DriverWithLocation) => { setFollowingId(driver.id); center(driver); };
  useEffect(() => {
    if (!followingId) return;
    const followed = online.find((driver) => driver.id === followingId);
    if (!followed?.location) return;
    camera.current?.easeTo({ center: [followed.location.longitude, followed.location.latitude], zoom: 16, duration: 850 });
  }, [followingId, online]);
  useEffect(() => { if (!driverId || !selected?.location || handledDriver.current === driverId) return; handledDriver.current = driverId; const timeout = setTimeout(() => camera.current?.easeTo({ center: [selected.location!.longitude, selected.location!.latitude], zoom: 16, duration: 550 }), 250); return () => clearTimeout(timeout); }, [driverId, selected?.location]);
  useEffect(() => {
    if (!mapReady || driverId || framedTeam.current || !online.length) return;
    framedTeam.current = true;
    if (online.length === 1) return center(online[0]!);
    const longitudes = online.map((driver) => driver.location!.longitude);
    const latitudes = online.map((driver) => driver.location!.latitude);
    camera.current?.fitBounds(
      [Math.min(...longitudes), Math.min(...latitudes), Math.max(...longitudes), Math.max(...latitudes)],
      { padding: { top: 110, right: 55, bottom: 110, left: 55 }, duration: 650 },
    );
  }, [driverId, mapReady, online]);
  const myLocation = async () => { if (me) { camera.current?.easeTo({ center: [me.longitude, me.latitude], zoom: 16, duration: 550 }); return; } const permission = await Location.requestForegroundPermissionsAsync(); if (permission.status !== 'granted') return; const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); camera.current?.easeTo({ center: [location.coords.longitude, location.coords.latitude], zoom: 16, duration: 550 }); };
  return <View style={styles.fill}><Map mapStyle={MAP_STYLE_URL} style={styles.fill} compass attribution logo onDidFinishLoadingMap={() => setMapReady(true)} onPress={() => setFollowingId(null)} onRegionWillChange={(event) => { if (event.nativeEvent.userInteraction) setFollowingId(null); }}>
    <Camera ref={camera} initialViewState={{ center: [-46.6333, -23.5505], zoom: 11 }} minZoom={3} maxZoom={19} />
    {online.map((driver) => <AnimatedDriverMarker key={driver.id} driver={driver} selected={selected?.id === driver.id} onPress={() => { setSelectedId(driver.id); center(driver); }}/>)}</Map>
    <View style={styles.top}><View style={styles.badge}><Users size={18} color={colors.amber}/><AppText weight="700" style={styles.overlayText}>{online.length} online</AppText></View></View>
    <Button accessibilityLabel="Minha localização" title="" variant="accent" icon={<Crosshair size={24} color={colors.navy}/>} onPress={myLocation} style={styles.locate}/>
    {isLoading ? <View style={styles.loading}><ActivityIndicator color={colors.amber}/></View> : null}
    {error ? <View style={styles.empty}><AppText weight="700" style={styles.overlayText}>Não foi possível carregar a equipe</AppText><AppText size={13} style={styles.overlayMuted}>Verifique a internet e abra o mapa novamente.</AppText></View> : null}
    {!isLoading && !error && !online.length ? <View style={styles.empty}><AppText weight="700" style={styles.overlayText}>Ninguém online no momento</AppText><AppText size={13} style={styles.overlayMuted}>Cada integrante precisa tocar em Ficar online.</AppText></View> : null}
    {selected ? <DriverSheet driver={selected} distance={distanceKm(me, selected.location)} following={followingId === selected.id} onFollow={() => follow(selected)} onClose={() => { setFollowingId(null); setSelectedId(null); }}/> : null}
  </View>;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, top: { position: 'absolute', top: 54, left: spacing.md }, badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.darkCard, paddingHorizontal: spacing.md, height: 42, borderWidth: 1, borderColor: colors.darkLine, borderRadius: 8, elevation: 4 }, locate: { position: 'absolute', right: spacing.md, bottom: 42, width: 52, minHeight: 52, paddingHorizontal: 0 }, loading: { position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.darkLine, padding: spacing.lg, borderRadius: 8 }, empty: { position: 'absolute', top: 110, alignSelf: 'center', backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.darkLine, borderRadius: 8, padding: spacing.md, alignItems: 'center', gap: 4 }, overlayText: { color: colors.onSurface }, overlayMuted: { color: colors.gray } });
