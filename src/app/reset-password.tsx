import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { IconTile, PageIntro } from '@/components/design';
import { Button, Card, Field, Screen } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { isStrongPassword, LIMITS, PASSWORD_REQUIREMENTS } from '@/validations/auth';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (!isStrongPassword(password)) return Alert.alert('Senha inválida', PASSWORD_REQUIREMENTS); if (password !== confirmation) return Alert.alert('Senhas diferentes', 'A confirmação precisa ser igual à nova senha.'); setLoading(true); const { error } = await supabase.auth.updateUser({ password }); setLoading(false); if (error) return Alert.alert('Não foi possível alterar', error.message); Alert.alert('Senha atualizada', 'Sua nova senha já está ativa.'); router.replace('/(tabs)'); };
  return <Screen style={styles.screen}><View style={styles.hero}><IconTile Icon={KeyRound} size={24}/><PageIntro eyebrow="Segurança" title="Crie uma nova senha" subtitle="Use uma senha exclusiva para proteger sua localização e sua equipe."/></View><Card style={styles.form}><Field label="Nova senha" placeholder="8 ou mais caracteres" maxLength={LIMITS.password} secureTextEntry value={password} onChangeText={setPassword}/><Field label="Confirmar senha" placeholder="Repita a nova senha" maxLength={LIMITS.password} secureTextEntry value={confirmation} onChangeText={setConfirmation}/><Button title="Atualizar senha" onPress={submit} loading={loading}/></Card></Screen>;
}
const styles = StyleSheet.create({ screen: { maxWidth: 520, justifyContent: 'center' }, hero: { gap: spacing.md }, form: { gap: spacing.md } });
