import { Redirect, Tabs, useTheme } from 'expo-router';
import { Home, Map, Users, UserRound } from 'lucide-react-native';
import { colors, fonts } from '@/constants/theme';
import { useAuthStore } from '@/stores/auth-store';

export default function TabsLayout() {
  const theme = useTheme();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile?.is_master_admin) return <Redirect href={'/master-admin' as never} />;
  if (profile && profile.account_status !== 'active') return <Redirect href={'/pending' as never} />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.amber, tabBarInactiveTintColor: colors.gray, tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold, letterSpacing: .4 }, tabBarItemStyle: { paddingVertical: 4 }, tabBarStyle: { height: 72, paddingTop: 7, paddingBottom: 9, backgroundColor: theme.colors.background, borderTopColor: theme.colors.border } }}>
    <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color }) => <Home color={color} size={22}/> }}/>
    <Tabs.Screen name="map" options={{ title: 'Mapa', tabBarIcon: ({ color }) => <Map color={color} size={22}/> }}/>
    <Tabs.Screen name="team" options={{ title: 'Equipe', tabBarIcon: ({ color }) => <Users color={color} size={22}/> }}/>
    <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color }) => <UserRound color={color} size={22}/> }}/>
  </Tabs>;
}
