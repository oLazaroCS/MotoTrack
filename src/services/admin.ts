import type { AccountStatus, Profile, Team, UserRole } from '@/types/domain';
import { supabase } from './supabase';

export type CreateManagedUser = {
  name: string;
  nickname: string;
  email: string;
  phone: string;
  driverCode: string;
  password: string;
  role: UserRole;
  teamId: string;
};

export type ManagedUserChanges = Partial<{
  name: string;
  nickname: string;
  email: string;
  phone: string;
  driver_code: string;
  password: string;
  team_id: string;
  role: UserRole;
  account_status: AccountStatus;
}>;

async function invokeAdmin(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const createManagedUser = (user: CreateManagedUser) => invokeAdmin({ action: 'create-user', user });
export const updateManagedUser = (userId: string, changes: ManagedUserChanges) => invokeAdmin({ action: 'update-user', userId, changes });
export const deleteManagedUser = (userId: string) => invokeAdmin({ action: 'delete-user', userId });
export const createManagedTeam = (team: { name: string; tag: string; joinCode: string; adminUserId?: string }) => invokeAdmin({ action: 'create-team', team });
export const updateManagedTeam = (teamId: string, changes: Partial<Pick<Team, 'name' | 'tag' | 'join_code' | 'logo_url'>>, adminUserId?: string) => invokeAdmin({ action: 'update-team', teamId, changes, adminUserId });
export const deleteManagedTeam = (teamId: string) => invokeAdmin({ action: 'delete-team', teamId });

export async function fetchManagedTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select('id, name, tag, join_code, logo_url, created_by').order('name');
  if (error) throw error;
  return Promise.all((data as Team[]).map(async (team) => ({ ...team, logo_url: await signedTeamLogoUrl(team.logo_url) })));
}

export async function fetchManagedUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error) throw error;
  return Promise.all((data as Profile[]).map(async (profile) => ({ ...profile, avatar_url: await signedAvatarUrl(profile.avatar_url) })));
}

async function signedAvatarUrl(path: string | null) {
  if (!path || path.startsWith('http')) return path;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function uploadTeamLogo(teamId: string, uri: string) {
  const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const path = `${teamId}/logo.${extension}`;
  const { error } = await supabase.storage.from('team-logos').upload(path, buffer, { upsert: true, contentType: response.headers.get('content-type') || 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function signedTeamLogoUrl(path: string | null) {
  if (!path || path.startsWith('http')) return path;
  const { data } = await supabase.storage.from('team-logos').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
