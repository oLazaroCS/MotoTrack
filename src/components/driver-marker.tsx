import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { isStale } from '@/utils/format';

export function DriverMarker({ name, avatar, updatedAt, selected }: { name: string; avatar?: string | null; updatedAt: string; selected?: boolean }) {
  const stale = isStale(updatedAt);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <View collapsable={false} style={styles.wrap}><View style={[styles.photo, selected && styles.selected, stale && styles.stale]}><Text style={styles.initials}>{initials || '?'}</Text>{avatar ? <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={avatar}/> : null}<View style={[styles.dot, { backgroundColor: stale ? colors.stale : colors.green }]}/></View><MapPin fill={stale ? colors.stale : colors.amber} color={colors.darkBg} size={22}/><Text numberOfLines={1} style={styles.name}>{name.split(' ')[0]}</Text></View>;
}
const styles = StyleSheet.create({ wrap: { width: 88, alignItems: 'center' }, photo: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, borderColor: colors.darkLine, backgroundColor: colors.darkOverlay, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', elevation: 5 }, selected: { borderColor: colors.amber }, stale: { opacity: .75 }, initials: { color: colors.onSurface, fontSize: 16, fontWeight: '800' }, dot: { position: 'absolute', width: 12, height: 12, borderRadius: 6, right: 0, bottom: 1, borderWidth: 2, borderColor: colors.darkBg }, name: { maxWidth: 84, backgroundColor: colors.darkCard, borderWidth: 1, borderColor: colors.darkLine, color: colors.onSurface, fontSize: 11, fontWeight: '700', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 } });
