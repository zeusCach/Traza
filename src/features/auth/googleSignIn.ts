import { openAuthSessionAsync } from 'expo-web-browser';

import { supabase } from '@/database/supabase';

const redirectTo = 'traza://acceso';

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase no está configurado');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) throw error ?? new Error('Google no devolvió una URL de acceso');

  const result = await openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const callback = new URL(result.url);
  const code = callback.searchParams.get('code');
  if (callback.protocol !== 'traza:' || callback.hostname !== 'acceso' || !code) {
    throw new Error('El acceso con Google no devolvió un código válido');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}
