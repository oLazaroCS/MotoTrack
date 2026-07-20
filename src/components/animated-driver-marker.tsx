import { Marker } from '@maplibre/maplibre-react-native';
import type { DriverWithLocation } from '@/types/domain';
import { DriverMarker } from './driver-marker';

export function AnimatedDriverMarker({ driver, selected, onPress }: { driver: DriverWithLocation; selected: boolean; onPress: () => void }) {
  const location = driver.location!;
  return <Marker id={driver.id} lngLat={[location.longitude, location.latitude]} anchor="bottom" onPress={onPress}><DriverMarker name={driver.nickname || driver.name} avatar={driver.avatar_url} updatedAt={location.updated_at} selected={selected}/></Marker>;
}
