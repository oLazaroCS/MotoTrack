import type { DriverLocation, DriverWithLocation, Profile, Team, TeamMembership } from '@/types/domain';
import { signedTeamLogoUrl } from './admin';
import { invalidateAvatarCache, signedAvatarUrl } from './avatars';
import { supabase } from './supabase';
import { prepareImageForUpload } from './images';

export async function fetchTeamDrivers(teamId: string): Promise<DriverWithLocation[]> {
  const { data: memberships, error: membershipError } = await supabase.from('team_memberships').select('*').eq('team_id', teamId);
  if (membershipError) throw membershipError;
  const memberIds = (memberships ?? []).map((membership) => membership.user_id);
  if (!memberIds.length) return [];
  const [{ data: profiles, error: profileError }, { data: locations, error: locationError }] = await Promise.all([
    supabase.from('profiles').select('*').in('id', memberIds).order('name'),
    supabase.from('driver_locations').select('*').in('user_id', memberIds),
  ]);
  if (profileError) throw profileError;
  if (locationError) throw locationError;
  const byUser = new Map((locations as DriverLocation[] | null)?.map((item) => [item.user_id, item]));
  const membershipByUser = new Map(memberships.map((item) => [item.user_id, item]));
  return Promise.all((profiles as Profile[]).map(async (profile) => {
    const membership = membershipByUser.get(profile.id)!;
    return { ...profile, role: membership.role, account_status: membership.status, avatar_url: await signedAvatarUrl(profile.avatar_url), location: byUser.get(profile.id) ?? null };
  }));
}

export async function fetchTeam(teamId: string): Promise<Team> {
  const { data, error } = await supabase.from('teams').select('id, name, tag, join_code, logo_url, created_by').eq('id', teamId).single();
  if (error) throw error;
  const team = data as Team;
  return { ...team, logo_url: await signedTeamLogoUrl(team.logo_url) };
}

export async function updateProfile(id: string, changes: Partial<Pick<Profile, 'name' | 'nickname' | 'phone' | 'avatar_url'>>) {
  const { error } = await supabase.from('profiles').update(changes).eq('id', id);
  if (error) throw error;
}

export async function uploadAvatar(userId: string, uri: string) {
  const prepared = await prepareImageForUpload(uri);
  const response = await fetch(prepared.uri);
  const buffer = await response.arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, buffer, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' });
  if (error) throw error;
  invalidateAvatarCache(path);
  return path;
}

export async function fetchMyTeams(): Promise<(TeamMembership & { team: Team })[]> {
  const { data, error } = await supabase.from('team_memberships').select('team_id, role, status, created_at, teams(id, name, tag, join_code, logo_url, created_by)').order('created_at');
  if (error) throw error;
  return Promise.all((data ?? []).map(async (membership) => {
    const team = membership.teams as unknown as Team;
    const { teams: _teams, ...membershipData } = membership;
    return { ...(membershipData as TeamMembership), team: { ...team, logo_url: await signedTeamLogoUrl(team.logo_url) } };
  }));
}

export async function setActiveTeam(teamId: string) {
  const { error } = await supabase.rpc('set_active_team', { target_team: teamId });
  if (error) throw error;
}

export async function joinTeamByCode(code: string) {
  const { error } = await supabase.rpc('join_team_by_code', { team_code: code });
  if (error) throw error;
}
