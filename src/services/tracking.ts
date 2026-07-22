import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { LOCATION_TASK, prepareLocation, resetLocationFilter, sendLocation } from './location-task';

let webLocationWatchId: number | null = null;
let lastWebUpload = 0;
let webTrackingActive = false;
let pendingWebUpload: Promise<unknown> | null = null;
const WEB_MOVING_UPLOAD_INTERVAL_MS = 1_000;
const WEB_STOPPED_UPLOAD_INTERVAL_MS = 10_000;
const NATIVE_TRACKING_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1_000,
  distanceInterval: 1,
  deferredUpdatesInterval: 1_000,
  pausesUpdatesAutomatically: false,
  activityType: Location.ActivityType.AutomotiveNavigation,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'MotoTrack online',
    notificationBody: 'Sua localização está sendo compartilhada com a equipe.',
    notificationColor: '#F6A800',
  },
};

type WebPermissionStatus = 'undetermined' | 'granted' | 'denied';

async function getWebLocationPermission(): Promise<WebPermissionStatus> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return 'denied';
  if (!navigator.permissions?.query) return 'undetermined';
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state === 'granted' ? 'granted' : permission.state === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

function webPositionToLocation(position: GeolocationPosition): Location.LocationObject {
  return {
    coords: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      altitude: position.coords.altitude,
      accuracy: position.coords.accuracy,
      altitudeAccuracy: position.coords.altitudeAccuracy,
      heading: position.coords.heading,
      speed: position.coords.speed,
    },
    timestamp: position.timestamp,
  };
}

export function getPreciseLocation(): Promise<Location.LocationObject> {
  if (Platform.OS !== 'web') return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
  if (!navigator.geolocation) return Promise.reject(new Error('Este navegador não oferece acesso à localização'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(webPositionToLocation(position)),
      (error) => reject(new Error(error.code === 1
        ? 'Permita a localização precisa no ícone ao lado do endereço do site'
        : error.code === 3 ? 'A localização demorou demais. Verifique se a localização do Windows está ativada' : 'Não foi possível obter a localização atual')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  });
}

export async function checkLocationReadiness() {
  if (Platform.OS === 'web') {
    const services = typeof navigator !== 'undefined' && Boolean(navigator.geolocation) && globalThis.isSecureContext !== false;
    return { services, permission: await getWebLocationPermission() };
  }
  const services = await Location.hasServicesEnabledAsync();
  const permission = await Location.getForegroundPermissionsAsync();
  return { services, permission: permission.status };
}

export async function isTrackingRunning() {
  if (Platform.OS === 'web') return webTrackingActive;
  try {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  } catch {
    return false;
  }
}

export async function refreshTrackingConfiguration() {
  if (Platform.OS === 'web' || !(await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK))) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, NATIVE_TRACKING_OPTIONS);
}

export async function startTracking() {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('Este navegador não oferece acesso à localização');
    if (globalThis.isSecureContext === false) throw new Error('A localização exige HTTPS ou acesso por localhost');
    await resetLocationFilter();
    const current = await getPreciseLocation();
    const lastSync = await sendLocation(await prepareLocation(current, true));
    webTrackingActive = true;
    if (webLocationWatchId == null) {
      webLocationWatchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!webTrackingActive || pendingWebUpload) return;
          const upload = prepareLocation(webPositionToLocation(position)).then(async (location) => {
            const interval = (location.speed ?? 0) >= .7 ? WEB_MOVING_UPLOAD_INTERVAL_MS : WEB_STOPPED_UPLOAD_INTERVAL_MS;
            if (Date.now() - lastWebUpload < interval) return undefined;
            const syncedAt = await sendLocation(location);
            lastWebUpload = Date.now();
            return syncedAt;
          }).catch(() => undefined);
          pendingWebUpload = upload;
          void upload.finally(() => { if (pendingWebUpload === upload) pendingWebUpload = null; });
        },
        (error) => {
          if (error.code !== error.PERMISSION_DENIED) return;
          webTrackingActive = false;
          if (webLocationWatchId != null) navigator.geolocation.clearWatch(webLocationWatchId);
          webLocationWatchId = null;
          void supabase.rpc('set_my_offline');
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
      );
    }
    return lastSync;
  }

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') {
    throw new Error('Permissão de localização não concedida');
  }
  if (!(await Location.hasServicesEnabledAsync())) throw new Error('Ative o GPS para ficar online');
  if (Platform.OS === 'android') await Notifications.requestPermissionsAsync();

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    throw new Error(Platform.OS === 'android'
      ? 'Selecione "Permitir o tempo todo" para que sua equipe continue vendo sua localização com o app fechado'
      : 'Permita a localização em segundo plano para que sua equipe continue vendo sua posição com o app fechado');
  }

  // Only mark the driver online after every required permission is granted.
  // A denied background permission must not leave a short-lived online row.
  await resetLocationFilter();
  const current = await getPreciseLocation();
  const lastSync = await sendLocation(await prepareLocation(current, true));

  await Location.startLocationUpdatesAsync(LOCATION_TASK, NATIVE_TRACKING_OPTIONS);
  return lastSync;
}

export async function stopTracking() {
  if (Platform.OS === 'web') {
    webTrackingActive = false;
    if (webLocationWatchId != null) navigator.geolocation.clearWatch(webLocationWatchId);
    webLocationWatchId = null;
    lastWebUpload = 0;
    await pendingWebUpload;
    pendingWebUpload = null;
  } else if (await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  await resetLocationFilter();
  const { error } = await supabase.rpc('set_my_offline');
  if (error) throw new Error(error.message);
}
