import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/auth-store';

export default function Index() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  if (!session) return <Redirect href="/(auth)/login" />;
  if (profile?.is_master_admin) return <Redirect href={'/master-admin' as never} />;
  if (profile && profile.account_status !== 'active') return <Redirect href={'/pending' as never} />;
  return <Redirect href="/(tabs)" />;
}
