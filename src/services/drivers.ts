import type { DriverLocation, DriverWithLocation, Profile, Team } from '@/types/domain';
import { signedTeamLogoUrl } from './admin';
import { supabase } from './supabase';

const AVATAR_URL_TTL_MS = 50 * 60 * 1000;
const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function fetchTeamDrivers(teamId: string): Promise<DriverWithLocation[]> {
  const [{ data: profiles, error: profileError }, { data: locations, error: locationError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('team_id', teamId).order('name'),
    supabase.from('driver_locations').select('*').eq('team_id', teamId),
  ]);
  if (profileError) throw profileError;
  if (locationError) throw locationError;
  const byUser = new Map((locations as DriverLocation[] | null)?.map((item) => [item.user_id, item]));
  return Promise.all((profiles as Profile[]).map(async (profile) => ({ ...profile, avatar_url: await signedAvatarUrl(profile.avatar_url), location: byUser.get(profile.id) ?? null })));
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
  const extension = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  const path = `${userId}/avatar.${extension}`;
  const { error } = await supabase.storage.from('avatars').upload(path, buffer, { upsert: true, contentType: response.headers.get('content-type') || 'image/jpeg' });
  if (error) throw error;
  avatarUrlCache.delete(path);
  return path;
}

export async function signedAvatarUrl(path: string | null) {
  if (!path || path.startsWith('http')) return path;
  const cached = avatarUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 60 * 60);
  if (!data?.signedUrl) return null;
  const separator = data.signedUrl.includes('?') ? '&' : '?';
  const url = `${data.signedUrl}${separator}v=${Date.now()}`;
  avatarUrlCache.set(path, { url, expiresAt: Date.now() + AVATAR_URL_TTL_MS });
  return url;
}
