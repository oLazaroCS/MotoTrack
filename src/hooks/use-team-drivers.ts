import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTeamDrivers } from '@/services/drivers';
import { supabase } from '@/services/supabase';
import type { DriverLocation } from '@/types/domain';

export function useTeamDrivers(teamId?: string) {
  const client = useQueryClient();
  const queryKey = ['drivers', teamId] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => fetchTeamDrivers(teamId!),
    enabled: Boolean(teamId),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    // Realtime is the fast path. Polling repairs missed events after Android
    // suspends the app or a mobile network silently drops the websocket.
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (!teamId) return;
    const channelId = Math.random().toString(36).slice(2);
    const channel = supabase.channel(`team-locations:${teamId}:${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations', filter: `team_id=eq.${teamId}` }, (payload) => {
        const next = payload.new as DriverLocation;
        if (!next?.user_id || Date.now() - new Date(next.updated_at).getTime() > 15 * 60_000) return;
        client.setQueryData<Awaited<ReturnType<typeof fetchTeamDrivers>>>(['drivers', teamId], (current) =>
          current?.map((driver) => driver.id === next.user_id ? { ...driver, location: next } : driver));
      }).subscribe((status) => {
        if (status === 'SUBSCRIBED') void client.invalidateQueries({ queryKey: ['drivers', teamId] });
      });
    return () => { void supabase.removeChannel(channel); };
  }, [client, teamId]);
  useEffect(() => {
    if (!teamId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.invalidateQueries({ queryKey: ['drivers', teamId] });
    });
    return () => subscription.remove();
  }, [client, teamId]);
  return query;
}
