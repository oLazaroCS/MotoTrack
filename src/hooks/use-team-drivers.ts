import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateAvatarCache } from '@/services/avatars';
import { fetchTeamDrivers, fetchTeamsDrivers, type DriverAcrossTeams } from '@/services/drivers';
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        const next = payload.new as DriverLocation;
        if (!next?.user_id || Date.now() - new Date(next.updated_at).getTime() > 15 * 60_000) return;
        client.setQueryData<Awaited<ReturnType<typeof fetchTeamDrivers>>>(['drivers', teamId], (current) =>
          current?.map((driver) => driver.id === next.user_id ? { ...driver, location: next } : driver));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        // Profile changes are less frequent and may include a new private avatar
        // path. Refetching also creates a fresh signed URL for every client.
        invalidateAvatarCache();
        void client.invalidateQueries({ queryKey: ['drivers', teamId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_memberships', filter: `team_id=eq.${teamId}` }, () => {
        void client.invalidateQueries({ queryKey: ['drivers', teamId] });
      })
      .subscribe((status) => {
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

export function useAllTeamDrivers(teamIds: string[], enabled: boolean) {
  const client = useQueryClient();
  const teamKey = [...new Set(teamIds)].sort().join(',');
  const queryKey = ['drivers', 'all-teams', teamKey] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => fetchTeamsDrivers(teamKey.split(',').filter(Boolean)),
    enabled: enabled && Boolean(teamKey),
    refetchOnMount: 'always',
    refetchOnReconnect: 'always',
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (!enabled || !teamKey) return;
    const scopedTeamIds = new Set(teamKey.split(','));
    const channelId = Math.random().toString(36).slice(2);
    const channel = supabase.channel(`all-team-locations:${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        const next = payload.new as DriverLocation;
        if (!next?.user_id) return;
        client.setQueryData<DriverAcrossTeams[]>(['drivers', 'all-teams', teamKey], (current) =>
          current?.map((driver) => driver.id === next.user_id ? { ...driver, location: next } : driver));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        invalidateAvatarCache();
        void client.invalidateQueries({ queryKey: ['drivers', 'all-teams', teamKey] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_memberships' }, (payload) => {
        const next = payload.new as { team_id?: string } | null;
        const changed = (next && Object.keys(next).length ? next : payload.old) as { team_id?: string };
        if (changed.team_id && scopedTeamIds.has(changed.team_id)) void client.invalidateQueries({ queryKey: ['drivers', 'all-teams', teamKey] });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') void client.invalidateQueries({ queryKey: ['drivers', 'all-teams', teamKey] });
      });
    return () => { void supabase.removeChannel(channel); };
  }, [client, enabled, teamKey]);
  useEffect(() => {
    if (!enabled || !teamKey) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.invalidateQueries({ queryKey: ['drivers', 'all-teams', teamKey] });
    });
    return () => subscription.remove();
  }, [client, enabled, teamKey]);
  return query;
}
