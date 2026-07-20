import { router } from 'expo-router';
import { Bell, LocateFixed, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { IconTile, PageIntro } from '@/components/design';
import { AppText, Button, Card, Screen } from '@/components/ui';
import { spacing } from '@/constants/theme';

const items = [
  { Icon: LocateFixed, title: 'Localização durante o trabalho', text: 'Sua posição só é enviada quando você escolhe ficar online.' },
  { Icon: Bell, title: 'Aviso persistente', text: 'No Android, uma notificação indica quando o rastreamento está ativo.' },
  { Icon: ShieldCheck, title: 'Visível apenas à equipe', text: 'As regras do banco restringem seus dados aos membros autorizados.' },
];
export default function PermissionsScreen() {
  return <Screen style={styles.screen}><PageIntro eyebrow="Privacidade primeiro" title="Antes de começar" subtitle="O MotoTrack pedirá as permissões somente quando você decidir ficar online."/><Card style={styles.list}>{items.map(({ Icon, title, text }) => <View key={title} style={styles.item}><IconTile Icon={Icon}/><View style={styles.copy}><AppText weight="600">{title}</AppText><AppText tone="muted" size={13} style={styles.body}>{text}</AppText></View></View>)}</Card><Button title="Entendi" onPress={() => router.replace('/(tabs)')}/></Screen>;
}
const styles = StyleSheet.create({ screen: { maxWidth: 560, justifyContent: 'center' }, list: { gap: spacing.lg }, item: { flexDirection: 'row', gap: spacing.md }, copy: { flex: 1, gap: 4 }, body: { lineHeight: 19 } });
