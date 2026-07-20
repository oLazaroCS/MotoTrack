import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Link, router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { Bike } from 'lucide-react-native';
import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { supabase } from '@/services/supabase';
import { LIMITS, normalizePhone, registerSchema, type RegisterInput } from '@/validations/auth';

export default function RegisterScreen() {
  const [message, setMessage] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', nickname: '', email: '', phone: '', teamCode: '', password: '' } });
  const submit = handleSubmit(async (values) => {
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({ email: values.email.trim(), password: values.password, options: { data: { name: values.name.trim(), nickname: values.nickname.trim(), phone: normalizePhone(values.phone), team_code: values.teamCode.trim().toUpperCase() } } });
    if (error) return setMessage(error.message);
    if (!data.session) {
      Alert.alert('Confirme seu e-mail', 'Enviamos um link de confirmação. Depois de confirmar, entre com sua senha.');
      return router.replace('/(auth)/login');
    }
    router.replace('/pending' as never);
  });
  return <Screen style={styles.screen}>
    <View style={styles.brandRow}><View style={styles.logo}><Bike color={colors.navy} size={24}/></View><View style={styles.brandCopy}><AppText size={12} weight="600" style={styles.eyebrow}>NOVO INTEGRANTE</AppText><AppText size={28} weight="700">Criar conta</AppText></View></View>
    <AppText tone="muted">Use os dados fornecidos pela sua equipe. Seu acesso será liberado por um administrador.</AppText>
    <Card style={styles.form}>
      <Controller control={control} name="name" render={({ field }) => <Field label="Nome completo" placeholder="Ex.: Maria Silva" maxLength={LIMITS.name} value={field.value} onChangeText={field.onChange} error={errors.name?.message}/>}/>
      <Controller control={control} name="nickname" render={({ field }) => <Field label="Apelido" placeholder="Ex.: Mari" maxLength={LIMITS.nickname} value={field.value} onChangeText={field.onChange} error={errors.nickname?.message}/>}/>
      <Controller control={control} name="email" render={({ field }) => <Field label="E-mail" placeholder="nome@empresa.com" maxLength={LIMITS.email} keyboardType="email-address" autoCapitalize="none" value={field.value} onChangeText={field.onChange} error={errors.email?.message}/>}/>
      <Controller control={control} name="phone" render={({ field }) => <Field label="Telefone com DDD" placeholder="(11) 99999-9999" maxLength={LIMITS.phone} keyboardType="phone-pad" value={field.value} onChangeText={field.onChange} error={errors.phone?.message}/>}/>
      <AppText tone="muted" size={12}>Seu ID exclusivo será gerado automaticamente ao finalizar o cadastro.</AppText>
      <Controller control={control} name="teamCode" render={({ field }) => <Field label="Código da equipe" placeholder="Código fornecido pela equipe" maxLength={LIMITS.teamCode} autoCapitalize="characters" value={field.value} onChangeText={field.onChange} error={errors.teamCode?.message}/>}/>
      <Controller control={control} name="password" render={({ field }) => <Field label="Senha" placeholder="8 ou mais caracteres" maxLength={LIMITS.password} secureTextEntry value={field.value} onChangeText={field.onChange} error={errors.password?.message}/>}/>
      {message ? <AppText tone="danger">{message}</AppText> : null}<Button title="Cadastrar" onPress={submit} loading={isSubmitting}/>
    </Card>
    <AppText style={styles.center}>Já possui uma conta? <Link href="/(auth)/login" style={styles.link}>Entrar</Link></AppText>
  </Screen>;
}

const styles = StyleSheet.create({ screen: { maxWidth: 600, paddingVertical: spacing.lg }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, logo: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }, brandCopy: { gap: 2 }, eyebrow: { color: colors.amber, letterSpacing: .9 }, form: { gap: spacing.md }, center: { textAlign: 'center' }, link: { color: colors.amber, fontFamily: fonts.semibold } });
