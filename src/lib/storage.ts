import { SUPABASE_URL } from './supabase/env';

/**
 * Public URL for an object in a public Storage bucket.
 *
 * Kept in one place so buckets can be renamed or fronted by a CDN without
 * touching components.
 */
export function storageUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL()}/storage/v1/object/public/${bucket}/${path}`;
}

export const playerPhotoUrl = (path: string | null | undefined) => storageUrl('players', path);
export const mediaUrl = (path: string | null | undefined) => storageUrl('media', path);
export const brandingUrl = (path: string | null | undefined) => storageUrl('branding', path);
