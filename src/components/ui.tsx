import { cloneElement, isValidElement, useState, type PropsWithChildren, type ReactElement, type ReactNode, type RefObject } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableProps, type TextInputProps, type TextProps, type ViewStyle } from 'react-native';
import { useTheme } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export function Screen({ children, scroll = true, style, scrollRef }: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle; scrollRef?: RefObject<ScrollView | null> }>) {
  const theme = useTheme();
  const content = <View style={[styles.content, style]}>{children}</View>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]} edges={['top']}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboard}>{scroll ? <ScrollView ref={scrollRef} style={styles.scrollView} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets contentInsetAdjustmentBehavior="automatic">{content}</ScrollView> : content}</KeyboardAvoidingView></SafeAreaView>;
}

export function AppText({ children, tone = 'default', size = 15, weight = '400', style, ...props }: PropsWithChildren<{ tone?: 'default' | 'muted' | 'danger' | 'success'; size?: number; weight?: '400' | '500' | '600' | '700' | '800' } & Omit<TextProps, 'children'>>) {
  const theme = useTheme();
  const color = tone === 'muted' ? (theme.dark ? colors.grayDark : colors.gray) : tone === 'danger' ? (theme.dark ? colors.redBright : colors.red) : tone === 'success' ? (theme.dark ? colors.greenBright : colors.green) : theme.colors.text;
  const fontFamily = weight === '800' ? fonts.extrabold : weight === '700' ? fonts.bold : weight === '600' ? fonts.semibold : weight === '500' ? fonts.medium : fonts.regular;
  return <Text {...props} style={[{ color, fontSize: size, fontFamily, letterSpacing: 0 }, style]}>{children}</Text>;
}

export function Button({ title, icon, variant = 'primary', loading, disabled, style, ...props }: PressableProps & { title: string; icon?: ReactNode; variant?: 'primary' | 'accent' | 'outline' | 'danger' | 'ghost'; loading?: boolean }) {
  const backgroundColor = ['primary', 'accent'].includes(variant) ? colors.amber : variant === 'danger' ? colors.red : 'transparent';
  const foreground = ['primary', 'accent'].includes(variant) ? colors.navy : ['outline', 'ghost'].includes(variant) ? colors.amber : colors.navy;
  const renderedIcon = isValidElement(icon) ? cloneElement(icon as ReactElement<{ color?: string }>, { color: foreground }) : icon;
  return <Pressable disabled={disabled || loading} style={({ pressed }) => [styles.button, { backgroundColor, borderColor: variant === 'outline' ? colors.amber : backgroundColor, opacity: pressed || disabled ? .62 : 1 }, style as object]} {...props}>
    {loading ? <ActivityIndicator color={foreground} /> : <>{renderedIcon}<Text style={[styles.buttonText, { color: foreground }]}>{title}</Text></>}
  </Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const { onFocus, onBlur, ...inputProps } = props;
  const semanticProps = semanticInputProps(label, Boolean(props.secureTextEntry));
  return <View style={styles.fieldWrap}><AppText weight="600" size={12} style={styles.fieldLabel}>{label.toUpperCase()}</AppText><TextInput {...semanticProps} placeholderTextColor={colors.gray} style={[styles.field, { color: theme.colors.text, backgroundColor: theme.colors.card, borderColor: error ? colors.red : focused ? colors.amber : theme.colors.border }]} onFocus={(event) => { setFocused(true); onFocus?.(event); }} onBlur={(event) => { setFocused(false); onBlur?.(event); }} {...inputProps}/>{error ? <AppText tone="danger" size={12}>{error}</AppText> : null}</View>;
}

function semanticInputProps(label: string, secure: boolean): Partial<TextInputProps> {
  const normalized = label.toLocaleLowerCase('pt-BR');
  if (normalized.includes('e-mail') || normalized.includes('email')) return { autoCapitalize: 'none', autoComplete: 'email', autoCorrect: false, importantForAutofill: 'yes', inputMode: 'email', keyboardType: 'email-address', spellCheck: false, textContentType: 'emailAddress' };
  if (normalized.includes('telefone')) return { autoComplete: 'tel', importantForAutofill: 'yes', inputMode: 'tel', keyboardType: 'phone-pad', textContentType: 'telephoneNumber' };
  if (secure || normalized.includes('senha')) {
    const isNew = normalized.includes('nova') || normalized.includes('temporária');
    return { autoComplete: isNew ? 'new-password' : 'current-password', importantForAutofill: 'yes', textContentType: isNew ? 'newPassword' : 'password' };
  }
  if (normalized === 'nome' || normalized === 'nome completo') return { autoCapitalize: 'words', autoComplete: 'name', importantForAutofill: 'yes', textContentType: 'name' };
  return {};
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, style]}>{children}</View>;
}

export function StatusDot({ online, stale = false }: { online: boolean; stale?: boolean }) {
  return <View style={[styles.dot, { backgroundColor: stale ? colors.stale : online ? colors.green : colors.gray }]} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, keyboard: { flex: 1 }, scrollView: { flex: 1 }, scroll: { flexGrow: 1 }, content: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.md, gap: spacing.md },
  button: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  buttonText: { fontSize: 15, fontFamily: fonts.bold, letterSpacing: 0 },
  fieldWrap: { gap: 6 }, fieldLabel: { color: colors.gray, letterSpacing: .65 }, field: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16, fontFamily: fonts.regular, letterSpacing: 0 },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md }, dot: { width: 10, height: 10, borderRadius: 5 },
});
