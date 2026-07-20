import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { IconTile, PageIntro } from '@/components/design';
import { colors, fonts, spacing } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { LIMITS } from '@/validations/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const submit = async () => { setLoading(true); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'mototrack://reset-password' }); setLoading(false); setMessage(error ? error.message : 'Enviamos as instruções para o seu e-mail.'); };
  return <Screen style={styles.screen}><View style={styles.hero}><IconTile Icon={KeyRound} size={24}/><PageIntro eyebrow="Segurança" title="Recuperar senha" subtitle="Você receberá um link seguro para criar uma nova senha."/></View><Card style={styles.form}><Field label="E-mail" placeholder="nome@empresa.com" maxLength={LIMITS.email} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/><Button title="Enviar instruções" onPress={submit} loading={loading}/>{message ? <AppText tone={message.startsWith('Enviamos') ? 'success' : 'danger'}>{message}</AppText> : null}</Card><Link href="/(auth)/login" style={styles.link}>Voltar ao login</Link></Screen>;
}
const styles = StyleSheet.create({ screen: { maxWidth: 520, justifyContent: 'center' }, hero: { gap: spacing.md }, form: { gap: spacing.md }, link: { textAlign: 'center', color: colors.amber, fontFamily: fonts.semibold, padding: spacing.sm } });
