import { useState } from 'react';
import { Image } from 'expo-image';
import { UserRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useVelocityTheme } from '@/hooks/use-velocity-theme';

export function Avatar({ uri, size = 48 }: { uri?: string | null; size?: number }) {
  const palette = useVelocityTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return <View style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.overlay, borderColor: palette.border }]}>{uri && uri !== failedUri ? <Image source={{ uri }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailedUri(uri)} style={StyleSheet.absoluteFill} /> : <UserRound size={size * .48} color={colors.gray}/>}</View>;
}
const styles = StyleSheet.create({ base: { overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' } });
