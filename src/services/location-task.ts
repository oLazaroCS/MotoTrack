import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';

export const LOCATION_TASK = 'mototrack-background-location';
const PENDING_KEY = 'mototrack:pending-locations';
const LAST_SENT_KEY = 'mototrack:last-sent-at';
const FILTERED_LOCATION_KEY = 'mototrack:filtered-location';
const LAST_UPLOAD_MS_KEY = 'mototrack:last-upload-ms';
const MAX_LOCATION_ACCURACY_METERS = 100;
const MAX_PLAUSIBLE_SPEED_MPS = 80;
const MOVING_UPLOAD_INTERVAL_MS = 1_000;
const STOPPED_UPLOAD_INTERVAL_MS = 10_000;
const PROFILE_CACHE_TTL_MS = 5 * 60_000;
let trackingProfileCache: { userId: string; teamId: string; expiresAt: number } | null = null;
let stationaryAnchor: QueuedLocation | null = null;
let speedSamples: QueuedLocation[] = [];

export type QueuedLocation = {
  latitude: number; longitude: number; accuracy: number | null; speed: number | null; heading: number | null; captured_at: string;
};

function serializeLocation(location: Location.LocationObject): QueuedLocation {
  const accuracy = location.coords.accuracy;
  const speed = location.coords.speed;
  const heading = location.coords.heading;
  return {
    latitude: location.coords.latitude, longitude: location.coords.longitude,
    accuracy: accuracy != null && Number.isFinite(accuracy) && accuracy >= 0 ? accuracy : null,
    speed: speed != null && Number.isFinite(speed) && speed >= 0 && speed <= MAX_PLAUSIBLE_SPEED_MPS ? speed : null,
    heading: heading != null && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading : null,
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

function clampSpeed(speed: number) {
  return Math.min(MAX_PLAUSIBLE_SPEED_MPS, Math.max(0, speed));
}

function rollingPositionSpeed(current: QueuedLocation) {
  const candidates = [...speedSamples, current];
  const currentTime = Date.parse(current.captured_at);
  const baseline = candidates.find((sample) => currentTime - Date.parse(sample.captured_at) >= 3_000);
  if (!baseline || accuracyOf(current) > 50 || accuracyOf(baseline) > 50) return null;
  const elapsedSeconds = (currentTime - Date.parse(baseline.captured_at)) / 1000;
  const distance = distanceMeters(baseline, current);
  const uncertainty = Math.max(3, Math.min(12, (accuracyOf(current) + accuracyOf(baseline)) * .2));
  return clampSpeed(Math.max(0, distance - uncertainty) / elapsedSeconds);
}

function recordSpeedSample(current: QueuedLocation) {
  const cutoff = Date.parse(current.captured_at) - 6_000;
  speedSamples = [...speedSamples, current].filter((sample) => Date.parse(sample.captured_at) >= cutoff).slice(-7);
}

function estimatedSpeed(current: QueuedLocation, previous: QueuedLocation, positionSpeed: number | null) {
  const sensorSpeed = current.speed;
  if (sensorSpeed == null) {
    if (positionSpeed != null) return positionSpeed;
    return clampSpeed((previous.speed ?? 0) * .65);
  }
  const safeSensorSpeed = clampSpeed(sensorSpeed);
  if (safeSensorSpeed < .7 && (positionSpeed ?? 0) < 1.2) return 0;
  if (positionSpeed == null) return safeSensorSpeed;

  // Android's Doppler speed is generally steadier than deriving speed from
  // coordinates. The coordinate estimate repairs devices that report stale or
  // missing sensor speed without allowing a GPS jump to create an absurd value.
  const blended = safeSensorSpeed * .72 + positionSpeed * .28;
  const previousSpeed = previous.speed;
  if (previousSpeed == null || !Number.isFinite(previousSpeed)) return blended;
  const response = Math.abs(blended - previousSpeed) > 8 ? .8 : .65;
  return clampSpeed(previousSpeed + (blended - previousSpeed) * response);
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
    stationaryAnchor = current;
    speedSamples = [current];
    await AsyncStorage.setItem(FILTERED_LOCATION_KEY, JSON.stringify(current));
    return current;
  }

  const distance = distanceMeters(previous, current);
  const elapsedSeconds = Math.max(.5, (Date.parse(current.captured_at) - Date.parse(previous.captured_at)) / 1000);
  const currentAccuracy = accuracyOf(current);
  const previousAccuracy = accuracyOf(previous);
  const noiseRadius = Math.max(6, Math.min(30, (currentAccuracy + previousAccuracy) * .6));
  const sensorSpeed = current.speed ?? 0;
  const poorReading = currentAccuracy > MAX_LOCATION_ACCURACY_METERS && previousAccuracy <= 50;
  const impossibleJump = distance / elapsedSeconds > MAX_PLAUSIBLE_SPEED_MPS
    || (distance > Math.max(250, elapsedSeconds * 70) && currentAccuracy > 20);
  const anchor = stationaryAnchor ?? previous;
  const anchorDistance = distanceMeters(anchor, current);
  const anchorElapsedSeconds = Math.max(0, (Date.parse(current.captured_at) - Date.parse(anchor.captured_at)) / 1000);
  const anchorNoiseRadius = Math.max(3, Math.min(10, (accuracyOf(anchor) + currentAccuracy) * .35));
  if (anchorDistance > anchorNoiseRadius) stationaryAnchor = current;
  const positionConfirmedStopped = anchorDistance <= anchorNoiseRadius && anchorElapsedSeconds >= 4;
  const stationary = (sensorSpeed < .7 && distance <= noiseRadius) || positionConfirmedStopped;

  // Keep publishing a heartbeat at the last reliable coordinate. This keeps a
  // stationary rider online without drawing the normal GPS drift on the map.
  if (poorReading || impossibleJump || stationary) {
    const stable = {
      ...current,
      latitude: previous.latitude,
      longitude: previous.longitude,
      speed: poorReading || impossibleJump ? clampSpeed((previous.speed ?? 0) * .5) : 0,
      heading: current.heading ?? previous.heading,
    };
    if (!poorReading && !impossibleJump) recordSpeedSample(current);
    await AsyncStorage.setItem(FILTERED_LOCATION_KEY, JSON.stringify(stable));
    return stable;
  }

  const positionSpeed = rollingPositionSpeed(current);
  const alpha = distance > 50 || sensorSpeed > 3 ? .92 : currentAccuracy <= 10 ? .82 : currentAccuracy <= 25 ? .68 : .48;
  const filtered = {
    ...current,
    latitude: previous.latitude + (current.latitude - previous.latitude) * alpha,
    longitude: previous.longitude + (current.longitude - previous.longitude) * alpha,
    speed: estimatedSpeed(current, previous, positionSpeed),
    heading: current.heading ?? previous.heading,
  };
  recordSpeedSample(current);
  if ((filtered.speed ?? 0) >= .7) stationaryAnchor ??= current;
  await AsyncStorage.setItem(FILTERED_LOCATION_KEY, JSON.stringify(filtered));
  return filtered;
}

export async function resetLocationFilter() {
  trackingProfileCache = null;
  stationaryAnchor = null;
  speedSamples = [];
  await Promise.all([
    AsyncStorage.removeItem(FILTERED_LOCATION_KEY),
    AsyncStorage.removeItem(LAST_UPLOAD_MS_KEY),
  ]);
}

async function queueLocation(location: QueuedLocation) {
  const current = JSON.parse((await AsyncStorage.getItem(PENDING_KEY)) || '[]') as QueuedLocation[];
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify([...current.slice(-19), location]));
}

async function activeTeamFor(userId: string) {
  if (trackingProfileCache?.userId === userId && trackingProfileCache.expiresAt > Date.now()) {
    return trackingProfileCache.teamId;
  }
  const { data: profile, error } = await supabase.from('profiles').select('team_id, account_status').eq('id', userId).single();
  if (error || profile.account_status !== 'active') throw error || new Error('Conta inativa');
  if (!profile.team_id) throw new Error('Usuário sem equipe');
  trackingProfileCache = { userId, teamId: profile.team_id, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS };
  return profile.team_id;
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
  const teamId = await activeTeamFor(user.id);
  const { error } = await supabase.from('driver_locations').upsert({
    user_id: user.id, team_id: teamId, ...location, is_online: true, updated_at: location.captured_at,
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
  const value = await prepareLocation(latest);
  const lastSent = Number(await AsyncStorage.getItem(LAST_UPLOAD_MS_KEY)) || 0;
  const interval = (value.speed ?? 0) >= .7 ? MOVING_UPLOAD_INTERVAL_MS : STOPPED_UPLOAD_INTERVAL_MS;
  if (Date.now() - lastSent < interval) return;
  try {
    await sendLocation(value);
    await AsyncStorage.setItem(LAST_UPLOAD_MS_KEY, String(Date.now()));
  } catch {
    await queueLocation(value);
  }
});

export async function getLastSync() { return AsyncStorage.getItem(LAST_SENT_KEY); }
