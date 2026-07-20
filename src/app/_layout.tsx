import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { darkTheme, fonts, lightTheme } from '@/constants/theme';
import { flushPendingLocations } from '@/services/location-task';
import { useAuthStore } from '@/stores/auth-store';
import { useTrackingStore } from '@/stores/tracking-store';
import { supabase } from '@/services/supabase';
import { useThemeStore } from '@/stores/theme-store';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, retry: 2 } } }));
  const initialized = useAuthStore((s) => s.initialized);
  const initialize = useAuthStore((s) => s.initialize);
  const setTracking = useTrackingStore((s) => s.setTracking);
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const themeMode = useThemeStore((s) => s.mode);
  const themeHydrated = useThemeStore((s) => s.hydrated);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const activeTheme = themeMode === 'light' ? lightTheme : darkTheme;

  useEffect(() => { let cleanup: undefined | (() => void); void initialize().then((value) => { cleanup = value; }); return () => cleanup?.(); }, [initialize]);
  useEffect(() => { void hydrateTheme(); }, [hydrateTheme]);
  useEffect(() => NetInfo.addEventListener((state) => {
    const connected = Boolean(state.isConnected && state.isInternetReachable !== false);
    setTracking({ isConnected: connected });
    if (connected) void flushPendingLocations().then((lastSync) => lastSync && setTracking({ lastSync }));
  }), [setTracking]);
  useEffect(() => {
    const hydrateFromUrl = async (url: string | null) => {
      if (!url) return;
      const rawParams = url.includes('#') ? url.split('#')[1] : url.split('?')[1];
      if (!rawParams) return;
      const params = new URLSearchParams(rawParams);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    };
    void Linking.getInitialURL().then(hydrateFromUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => { void hydrateFromUrl(url); });
    return () => subscription.remove();
  }, []);
  useEffect(() => { if (initialized && fontsLoaded && themeHydrated) void SplashScreen.hideAsync(); }, [fontsLoaded, initialized, themeHydrated]);

  if (!initialized || !fontsLoaded || !themeHydrated) return null;
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><QueryClientProvider client={client}>
    <ThemeProvider value={activeTheme}>
      <Stack screenOptions={{ headerShadowVisible: false, headerBackTitle: 'Voltar', headerStyle: { backgroundColor: activeTheme.colors.background }, headerTintColor: activeTheme.colors.text, headerTitleStyle: { fontFamily: fonts.semibold } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="driver/[id]" options={{ title: 'Detalhes do motoboy' }} />
        <Stack.Screen name="admin" options={{ title: 'Administração' }} />
        <Stack.Screen name="master-admin" options={{ headerShown: false }} />
        <Stack.Screen name="pending" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacidade' }} />
        <Stack.Screen name="offline" options={{ title: 'Sem conexão', presentation: 'modal' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Nova senha' }} />
      </Stack>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  </QueryClientProvider></SafeAreaProvider></GestureHandlerRootView>;
}
