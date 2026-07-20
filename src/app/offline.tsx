import { router } from 'expo-router';
import { RefreshCw, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { PageIntro } from '@/components/design';
import { Button, Card, Screen } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useTrackingStore } from '@/stores/tracking-store';

export default function OfflineScreen() { const connected = useTrackingStore((state) => state.isConnected); return <Screen style={styles.screen}><View style={styles.icon}><WifiOff size={40} color={colors.red}/></View><PageIntro eyebrow="Estado da conexão" title="Conexão perdida" subtitle="A última localização foi salva no aparelho e será sincronizada automaticamente quando a internet voltar."/><Card style={styles.card}><Button title={connected ? 'Conexão restabelecida' : 'Tentar novamente'} icon={<RefreshCw size={19} color={colors.navy}/>} onPress={() => router.back()}/></Card></Screen>; }
const styles = StyleSheet.create({ screen: { justifyContent: 'center', maxWidth: 520 }, icon: { width: 76, height: 76, borderRadius: radius.lg, backgroundColor: '#271B25', borderWidth: 1, borderColor: '#633A43', alignItems: 'center', justifyContent: 'center' }, card: { gap: spacing.md } });
