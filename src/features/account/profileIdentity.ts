import type { User } from '@supabase/supabase-js';

export function metadataText(user: User, key: string) {
  const value: unknown = user.user_metadata[key];
  return typeof value === 'string' ? value : '';
}

export function profileIdentity(user: User) {
  const name = [metadataText(user, 'first_name'), metadataText(user, 'last_name')].filter(Boolean).join(' ');
  return {
    name: name || metadataText(user, 'full_name') || user.email?.split('@')[0] || 'Ciclista',
    imageUri: metadataText(user, 'avatar_url') || metadataText(user, 'picture') || undefined,
  };
}
