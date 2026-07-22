import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

const MAX_ACCEPTED_ACCURACY_METERS = 100;

export function usePreciseUserLocation(fallback?: GeoPoint | null) {
  const [current, setCurrent] = useState<GeoPoint | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    let subscription: Location.LocationSubscription | undefined;

    const update = (location: Location.LocationObject) => {
      const { latitude, longitude, accuracy } = location.coords;
      if (!active || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (accuracy != null && accuracy > MAX_ACCEPTED_ACCURACY_METERS) return;
      setCurrent({ latitude, longitude, accuracy });
    };

    const start = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!active || permission.status !== 'granted') return;
      try {
        update(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }));
        subscription = await Location.watchPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1_000,
          distanceInterval: 1,
        }, update);
        if (!active) subscription.remove();
      } catch {
        // The synchronized server position remains available as a fallback.
      }
    };

    void start();
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []));

  return current ?? fallback ?? null;
}
