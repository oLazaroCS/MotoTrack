import { ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { IconTile, PageIntro, SectionLabel } from '@/components/design';
import { AppText, Card, Screen } from '@/components/ui';
import { spacing } from '@/constants/theme';

const sections = [
  ['Dados coletados', 'Mantemos os dados do perfil, identificador profissional, equipe e, quando você está online, coordenadas, precisão, velocidade, direção e horário da atualização.'],
  ['Finalidade', 'A localização permite que os membros autorizados da mesma equipe acompanhem a operação e coordenem entregas. Ela não é usada para publicidade.'],
  ['Quem pode visualizar', 'Integrantes autenticados veem somente posições online da própria equipe. Administradores autorizados podem consultar a última posição para gestão operacional.'],
  ['Quando o rastreamento funciona', 'O compartilhamento começa apenas após sua confirmação no botão Ficar online. Uma notificação permanece visível durante o rastreamento em segundo plano.'],
  ['Como interromper', 'Toque em Ficar offline. A tarefa de localização para imediatamente e o seu marcador é removido do mapa da equipe.'],
  ['Retenção e segurança', 'A posição atual é mantida enquanto necessária à operação. O histórico é opcional e, quando habilitado, deve ser removido automaticamente após 30 dias. O acesso é protegido por autenticação e políticas de equipe no banco.'],
];
export default function PrivacyScreen() { return <Screen><View style={styles.hero}><IconTile Icon={ShieldCheck} size={24}/><PageIntro eyebrow="Privacidade" title="Sua localização, sob seu controle" subtitle="Última revisão: julho de 2026"/></View><SectionLabel>COMO SEUS DADOS SÃO TRATADOS</SectionLabel>{sections.map(([title, text], index) => <Card key={title} style={styles.card}><AppText size={11} weight="600" style={styles.index}>{String(index + 1).padStart(2, '0')}</AppText><View style={styles.copy}><AppText size={17} weight="600">{title}</AppText><AppText tone="muted" size={14} style={styles.body}>{text}</AppText></View></Card>)}</Screen>; }
const styles = StyleSheet.create({ hero: { gap: spacing.md }, card: { flexDirection: 'row', gap: spacing.md }, index: { paddingTop: 3, letterSpacing: .7 }, copy: { flex: 1, gap: spacing.sm }, body: { lineHeight: 22 } });
