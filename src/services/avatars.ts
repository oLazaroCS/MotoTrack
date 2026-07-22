import { supabase } from './supabase';

const AVATAR_URL_TTL_MS = 50 * 60 * 1000;
const avatarUrlCache = new Map<string, { url: string; expiresAt: number }>();

function avatarObjectPath(value: string) {
  if (!value.startsWith('http')) return value;
  try {
    const url = new URL(value);
    const marker = '/storage/v1/object/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const segments = url.pathname.slice(markerIndex + marker.length).split('/').filter(Boolean);
    if (['sign', 'public', 'authenticated'].includes(segments[0] ?? '')) segments.shift();
    if (segments.shift() !== 'avatars' || !segments.length) return null;
    return decodeURIComponent(segments.join('/'));
  } catch {
    return null;
  }
}

export function invalidateAvatarCache(path?: string | null) {
  if (path === undefined) {
    avatarUrlCache.clear();
    return;
  }
  if (!path) return;
  const objectPath = avatarObjectPath(path);
  if (objectPath) avatarUrlCache.delete(objectPath);
}

export async function signedAvatarUrl(path: string | null) {
  if (!path) return null;
  const objectPath = avatarObjectPath(path);
  if (!objectPath) return path;
  const cached = avatarUrlCache.get(objectPath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) {
    if (__DEV__) console.warn('Não foi possível carregar a foto do integrante.', error?.message);
    return null;
  }
  const separator = data.signedUrl.includes('?') ? '&' : '?';
  const url = `${data.signedUrl}${separator}v=${Date.now()}`;
  avatarUrlCache.set(objectPath, { url, expiresAt: Date.now() + AVATAR_URL_TTL_MS });
  return url;
}
