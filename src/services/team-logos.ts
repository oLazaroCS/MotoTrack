import { supabase } from './supabase';

const TEAM_LOGO_URL_TTL_MS = 50 * 60 * 1000;
const teamLogoUrlCache = new Map<string, { url: string; expiresAt: number }>();

function teamLogoObjectPath(value: string) {
  if (!value.startsWith('http')) return value;
  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const segments = url.pathname.slice(markerIndex + marker.length).split('/').filter(Boolean);
    if (['sign', 'public', 'authenticated'].includes(segments[0] ?? '')) segments.shift();
    if (segments.shift() !== 'team-logos' || !segments.length) return null;
    return decodeURIComponent(segments.join('/'));
  } catch {
    return null;
  }
}

export function invalidateTeamLogoCache(path?: string | null) {
  if (path === undefined) {
    teamLogoUrlCache.clear();
    return;
  }
  if (!path) return;
  const objectPath = teamLogoObjectPath(path);
  if (objectPath) teamLogoUrlCache.delete(objectPath);
}

export async function signedTeamLogoUrl(path: string | null) {
  if (!path) return null;
  const objectPath = teamLogoObjectPath(path);
  if (!objectPath) return path;
  const cached = teamLogoUrlCache.get(objectPath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from('team-logos').createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) {
    if (__DEV__) console.warn('Não foi possível carregar o logo da equipe.', error?.message);
    return null;
  }
  const separator = data.signedUrl.includes('?') ? '&' : '?';
  const url = `${data.signedUrl}${separator}v=${Date.now()}`;
  teamLogoUrlCache.set(objectPath, { url, expiresAt: Date.now() + TEAM_LOGO_URL_TTL_MS });
  return url;
}
