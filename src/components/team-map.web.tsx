import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import maplibregl, { type Map as WebMap, type Marker as WebMarker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Crosshair, Users } from 'lucide-react-native';
import { DriverSheet } from '@/components/driver-sheet';
import { AppText, Button } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { DARK_MAP_STYLE } from '@/constants/map-style';
import { useTeamDrivers } from '@/hooks/use-team-drivers';
import { getPreciseLocation } from '@/services/tracking';
import { useAuthStore } from '@/stores/auth-store';
import type { DriverWithLocation } from '@/types/domain';
import { distanceKm, isStale } from '@/utils/format';

type MarkerEntry = { marker: WebMarker; element: HTMLButtonElement; photo: HTMLSpanElement; avatar: HTMLImageElement | null; name: HTMLSpanElement; status: HTMLSpanElement };

export default function TeamMapWebScreen() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<WebMap | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());
  const handledDriver = useRef<string | null>(null);
  const centeredOnUser = useRef(false);
  const { driver: driverId } = useLocalSearchParams<{ driver?: string }>();
  const profile = useAuthStore((state) => state.profile);
  const { data, isLoading } = useTeamDrivers(profile?.team_id ?? undefined);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null | undefined>(undefined);

  const online = useMemo(() => data?.filter((driver) => driver.location?.is_online && !isStale(driver.location.updated_at, 2)) ?? [], [data]);
  const selected = online.find((driver) => driver.id === (selectedId === undefined ? driverId : selectedId)) ?? null;
  const me = data?.find((driver) => driver.id === profile?.id)?.location;

  useEffect(() => {
    if (!container.current || map.current) return;
    const markerRegistry = markers.current;
    const instance = new maplibregl.Map({ container: container.current, style: DARK_MAP_STYLE, center: [-46.6333, -23.5505], zoom: 11, attributionControl: { compact: true } });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    instance.on('load', () => setMapReady(true));
    instance.on('click', () => setSelectedId(null));
    map.current = instance;
    return () => { markerRegistry.forEach((entry) => entry.marker.remove()); markerRegistry.clear(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const activeIds = new Set(online.map((driver) => driver.id));
    markers.current.forEach((entry, id) => { if (!activeIds.has(id)) { entry.marker.remove(); markers.current.delete(id); } });

    online.forEach((driver) => {
      const location = driver.location!;
      let entry = markers.current.get(driver.id);
      if (!entry) {
        entry = createMarker(driver, () => { setSelectedId(driver.id); centerDriver(instance, driver); });
        entry.marker.setLngLat([location.longitude, location.latitude]).addTo(instance);
        markers.current.set(driver.id, entry);
      }
      entry.photo.style.borderColor = selected?.id === driver.id ? colors.amber : colors.darkLine;
      entry.name.textContent = driver.nickname || driver.name.split(' ')[0] || driver.name;
      entry.status.style.backgroundColor = isStale(location.updated_at) ? colors.stale : colors.green;
      if (driver.avatar_url && entry.avatar) entry.avatar.src = driver.avatar_url;
      entry.marker.setLngLat([location.longitude, location.latitude]);
    });
  }, [online, selected?.id]);

  useEffect(() => {
    if (!mapReady || !driverId || !selected || handledDriver.current === driverId || !map.current) return;
    handledDriver.current = driverId;
    centerDriver(map.current, selected);
  }, [driverId, mapReady, selected]);

  useEffect(() => {
    if (!mapReady || centeredOnUser.current || !me || !map.current) return;
    centeredOnUser.current = true;
    map.current.easeTo({ center: [me.longitude, me.latitude], zoom: 16, duration: 550 });
  }, [mapReady, me]);

  const myLocation = async () => {
    if (me) {
      map.current?.easeTo({ center: [me.longitude, me.latitude], zoom: 17, duration: 550 });
      return;
    }
    setLocating(true);
    try {
      const location = await getPreciseLocation();
      const center: [number, number] = [location.coords.longitude, location.coords.latitude];
      map.current?.easeTo({ center, zoom: 17, duration: 550 });
      if (profile?.id) markers.current.get(profile.id)?.marker.setLngLat(center);
    } catch (error) {
      globalThis.alert(`Não foi possível localizar\n\n${error instanceof Error ? error.message : 'Verifique as permissões do navegador.'}`);
    } finally {
      setLocating(false);
    }
  };
  const center = (driver: DriverWithLocation) => { if (map.current) centerDriver(map.current, driver); };

  return <View style={styles.fill}>
    <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    <View style={styles.top}><View style={styles.badge}><Users size={18} color={colors.amber}/><AppText weight="700" style={styles.overlayText}>{online.length} online</AppText></View></View>
    <Button accessibilityLabel="Minha localização" title="" variant="accent" loading={locating} icon={<Crosshair size={24} color={colors.navy}/>} onPress={myLocation} style={styles.locate}/>
    {isLoading || !mapReady ? <View style={styles.loading}><ActivityIndicator color={colors.amber}/></View> : null}
    {!isLoading && mapReady && !online.length ? <View style={styles.empty}><AppText weight="700" style={styles.overlayText}>Ninguém online no momento</AppText><AppText size={13} style={styles.overlayMuted}>Os marcadores aparecem automaticamente.</AppText></View> : null}
    {selected ? <DriverSheet driver={selected} distance={distanceKm(me, selected.location)} onCenter={() => center(selected)} onClose={() => setSelectedId(null)}/> : null}
  </View>;
}

function centerDriver(map: WebMap, driver: DriverWithLocation) {
  const location = driver.location!;
  map.easeTo({ center: [location.longitude, location.latitude], zoom: 16, duration: 550 });
}

function createMarker(driver: DriverWithLocation, onPress: () => void): MarkerEntry {
  const element = document.createElement('button');
  element.type = 'button';
  element.setAttribute('aria-label', `Ver ${driver.name}`);
  Object.assign(element.style, { width: '88px', minHeight: '78px', padding: '0', border: '0', background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'visible' });
  element.addEventListener('click', (event) => { event.stopPropagation(); onPress(); });

  const photo = document.createElement('span');
  Object.assign(photo.style, { position: 'relative', width: '52px', height: '52px', borderRadius: '26px', border: `3px solid ${colors.amber}`, background: colors.darkOverlay, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px #FFC10744', transition: 'border-color 150ms ease' });
  const initials = document.createElement('span');
  initials.textContent = driver.name.trim().slice(0, 1).toUpperCase();
  Object.assign(initials.style, { color: colors.onSurface, font: '800 18px Inter, system-ui' });
  photo.appendChild(initials);
  let avatar: HTMLImageElement | null = null;
  if (driver.avatar_url) {
    avatar = document.createElement('img');
    avatar.src = driver.avatar_url;
    avatar.alt = '';
    Object.assign(avatar.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' });
    avatar.addEventListener('error', () => avatar?.remove());
    photo.appendChild(avatar);
  }
  const status = document.createElement('span');
  Object.assign(status.style, { position: 'absolute', right: '1px', bottom: '1px', width: '12px', height: '12px', borderRadius: '6px', border: `2px solid ${colors.darkBg}`, background: colors.green });
  photo.appendChild(status);

  const pin = document.createElement('span');
  Object.assign(pin.style, { width: '12px', height: '12px', marginTop: '-5px', background: colors.amber, transform: 'rotate(45deg)', borderRadius: '2px' });
  const name = document.createElement('span');
  name.textContent = driver.nickname || driver.name.split(' ')[0] || driver.name;
  Object.assign(name.style, { position: 'relative', marginTop: '-3px', maxWidth: '84px', padding: '3px 7px', border: `1px solid ${colors.darkLine}`, borderRadius: '4px', background: colors.darkCard, color: colors.onSurface, boxShadow: '0 2px 6px #0008', font: '700 11px Inter, system-ui', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
  element.append(photo, pin, name);
  return { marker: new maplibregl.Marker({ element, anchor: 'bottom' }), element, photo, avatar, name, status };
}

const styles = StyleSheet.create({ fill: { flex: 1 }, top: { position: 'absolute', top: spacing.md, left: spacing.md }, badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.darkCard, paddingHorizontal: spacing.md, height: 42, borderWidth: 1, borderColor: colors.darkLine, borderRadius: 8, boxShadow: '0 3px 10px #0008' }, locate: { position: 'absolute', right: spacing.md, bottom: 42, width: 52, minHeight: 52, paddingHorizontal: 0, boxShadow: '0 3px 10px #0008' }, loading: { position: 'absolute', top: '50%', alignSelf: 'center', backgroundColor: colors.darkCard, padding: spacing.lg, borderRadius: 8 }, empty: { position: 'absolute', top: 74, alignSelf: 'center', backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.darkLine, borderRadius: 8, padding: spacing.md, alignItems: 'center', gap: 4, boxShadow: '0 3px 10px #0008' }, overlayText: { color: colors.onSurface }, overlayMuted: { color: colors.gray } });
