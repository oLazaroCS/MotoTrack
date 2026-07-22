import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Image } from 'expo-image';
import { LogIn } from 'lucide-react-native';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import { loginSchema, type LoginInput } from '@/validations/auth';
import { LIMITS } from '@/validations/auth';

export default function LoginScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });
  const submit = handleSubmit(async (values) => {
    setMessage(null);
    if (!isSupabaseConfigured) return setMessage('Configure as variáveis do Supabase no arquivo .env.');
    const { error } = await supabase.auth.signInWithPassword(values);
    if (error) return setMessage(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
    router.replace('/(tabs)');
  });
  const revealPassword = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  return <Screen scrollRef={scrollRef} style={styles.screen}><View style={styles.fill}>
    <View style={styles.brand}><View style={styles.logo}><Image source={require('../../../assets/icon.png')} contentFit="cover" style={styles.logoImage}/></View><AppText size={12} weight="600" style={styles.eyebrow}>RASTREAMENTO DE EQUIPE</AppText><AppText size={30} weight="800">MotoTrack</AppText><AppText tone="muted" style={styles.center}>Sua equipe conectada, do início ao fim da rota.</AppText></View>
    <Card style={styles.form}><View style={styles.formTitle}><AppText size={21} weight="700">Acesse sua conta</AppText><AppText tone="muted" size={13}>Entre para acompanhar sua operação em tempo real.</AppText></View>
      <Controller control={control} name="email" render={({ field: { onChange, onBlur, value } }) => <Field label="E-mail" placeholder="nome@empresa.com" maxLength={LIMITS.email} autoCapitalize="none" keyboardType="email-address" autoComplete="email" onChangeText={onChange} onBlur={onBlur} value={value} error={errors.email?.message}/>}/>
      <Controller control={control} name="password" render={({ field: { onChange, onBlur, value } }) => <Field label="Senha" placeholder="Sua senha" maxLength={LIMITS.password} secureTextEntry autoComplete="current-password" onFocus={revealPassword} onChangeText={onChange} onBlur={onBlur} value={value} error={errors.password?.message}/>}/>
      {message ? <AppText tone="danger" size={13}>{message}</AppText> : null}
      <Button title="Entrar" icon={<LogIn size={19} color={colors.navy}/>} onPress={submit} loading={isSubmitting}/>
      <Link href="/(auth)/forgot-password" style={styles.link}>Esqueci minha senha</Link>
    </Card>
    <AppText style={styles.center}>Ainda não tem acesso? <Link href="/(auth)/register" style={styles.linkInline}>Criar conta</Link></AppText>
  </View></Screen>;
}

const styles = StyleSheet.create({
  screen: { maxWidth: 520 },
  fill: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  brand: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 76, height: 76, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.amber, overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  eyebrow: { color: colors.amber, letterSpacing: 1 },
  center: { textAlign: 'center', lineHeight: 21 },
  form: { gap: spacing.md },
  formTitle: { gap: 4, marginBottom: spacing.sm },
  link: { color: colors.amber, fontFamily: fonts.semibold, textAlign: 'center', paddingVertical: spacing.sm },
  linkInline: { color: colors.amber, fontFamily: fonts.semibold },
});
