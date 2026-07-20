import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

export const LOCATION_TASK = 'mototrack-background-location';
const PENDING_KEY = 'mototrack:pending-locations';
const LAST_SENT_KEY = 'mototrack:last-sent-at';
const FILTERED_LOCATION_KEY = 'mototrack:filtered-location';
const LAST_UPLOAD_MS_KEY = 'mototrack:last-upload-ms';

export type QueuedLocation = {
  latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null; captured_at: string;
};

function serializeLocation(location: Location.LocationObject): QueuedLocation {
  return {
    latitude: location.coords.latitude, longitude: location.coords.longitude,
    accuracy: location.coords.accuracy, speed: location.coords.speed, heading: location.coords.heading,
    captured_at: new Date(location.timestamp).toISOString(),
  };
}

function accuracyOf(location: QueuedLocation) {
  return location.accuracy != null && Number.isFinite(location.accuracy) ? Math.max(0, location.accuracy) : 50;
}

function distanceMeters(from: QueuedLocation, to: QueuedLocation) {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const latitude1 = from.latitude * radians;
  const latitude2 = to.latitude * radians;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function prepareLocation(location: Location.LocationObject, force = false): Promise<QueuedLocation> {
  const current = serializeLocation(location);
  let previous: QueuedLocation | null = null;
  try {
    const saved = await AsyncStorage.getItem(FILTERED_LOCATION_KEY);
    previous = saved ? JSON.parse(saved) as QueuedLocation : null;
  } catch {
    previous = null;
  }

  if (!previous || force) {
    await AsyncStorage.setItem(FILTERED_LOCATION_KEY, JSON.stringify(current));
    return current;
  }

  const distance = distanceMeters(previous, current);
  const elapsedSeconds = Math.max(1, (Date.parse(current.captured_at) - Date.parse(previous.captured_at)) / 1000);
  const currentAccuracy = accuracyOf(current);
  const previousAccuracy = accuracyOf(previous);
  const noiseRadius = Math.max(8, Math.min(35, (currentAccuracy + previousAccuracy) * .75));
  const reportedSpeed = Math.max(0, current.speed ?? 0);
  const poorReading = currentAccuracy > 100 && previousAccuracy <= 50;
  const impossibleJump = distance > Math.max(250, elapsedSeconds * 70) && currentAccuracy > 20;

  // Keep publishing a heartbeat at the last reliable coordinate. This keeps a
  // stationary rider online without drawing the normal GPS drift on the map.
  if (poorReading || impossibleJump || (reportedSpeed < 1.2 && distance <= noiseRadius)) {
    const stable = { ...current, latitude: previous.latitude, longitude: previous.longitude, speed: reportedSpeed < 1.2 ? 0 : current.speed };
    await AsyncStorage.setItem(FILTERED_LOCATION_KEY, JSON.stringify(stable));
    return stable;
  }

  const alpha = distance > 50 || reportedSpeed > 3 ? .9 : currentAccuracy <= 10 ? .8 : currentAccuracy <= 25 ? .65 : .45;
  const filtered = {
    ...current,
    latitude: previous.latitude + (current.latitude - previous.latitude) * alpha,
    longitude: previous.longitude + (current.longitude - previous.longitude) * alpha,
  };
  await AsyncStorage.setItem(FILTERED_LOCATION_KEY, JSON.stringify(filtered));
  return filtered;
}

export async function resetLocationFilter() {
  await Promise.all([
    AsyncStorage.removeItem(FILTERED_LOCATION_KEY),
    AsyncStorage.removeItem(LAST_UPLOAD_MS_KEY),
  ]);
}

async function queueLocation(location: QueuedLocation) {
  const current = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) || '[]') as QueuedLocation[];
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...current.slice(-19), location]));
}

export async function sendLocation(location: QueuedLocation) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  let activeSession = session;
  // Auto refresh is paused while React Native is in the background. Refresh
  // here so a long-running task keeps uploading after the access token expires.
  if (activeSession?.expires_at && activeSession.expires_at * 1000 <= Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) throw error;
    activeSession = data.session;
  }
  const user = activeSession?.user;
  if (!user) throw new Error('Sessão não encontrada');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('team_id, account_status').eq('id', user.id).single();
  if (profileError || profile.account_status !== 'active') throw profileError || new Error('Conta inativa');
  if (!profile.team_id) throw new Error('Usuário sem equipe');
  const { error } = await supabase.from('driver_locations').upsert({
    user_id: user.id, team_id: profile.team_id, ...location, is_online: true, updated_at: location.captured_at,
  }, { onConflict: 'user_id' });
  if (error) throw error;
  await Promise.all([
    AsyncStorage.setItem(LAST_SENT_KEY, location.captured_at),
    AsyncStorage.setItem('mototrack:last-location', JSON.stringify(location)),
  ]);
  return location.captured_at;
}

export async function flushPendingLocations() {
  const pending = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) || '[]') as QueuedLocation[];
  if (!pending.length) return null;
  let last: string | null = null;
  for (const location of pending) last = await sendLocation(location);
  await AsyncStorage.removeItem(PENDING_KEY);
  return last;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  const latest = data.locations[data.locations.length - 1];
  if (!latest) return;
  const raw = serializeLocation(latest);
  const lastSent = Number(await AsyncStorage.getItem(LAST_UPLOAD_MS_KEY)) || 0;
  const interval = (raw.speed ?? 0) > 0.5 ? 10_000 : 30_000;
  if (Date.now() - lastSent < interval) return;
  const value = await prepareLocation(latest);
  try {
    await sendLocation(value);
    await AsyncStorage.setItem(LAST_UPLOAD_MS_KEY, String(Date.now()));
  } catch {
    await queueLocation(value);
  }
});

export async function getLastSync() { return AsyncStorage.getItem(LAST_SENT_KEY); }
