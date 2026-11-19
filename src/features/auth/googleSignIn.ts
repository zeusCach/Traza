import { openAuthSessionAsync } from 'expo-web-browser';

import { supabase } from '@/database/supabase';

const redirectTo = 'traza://acceso';

export class GoogleSignInError extends Error {}

export function googleSignInMessage(error: unknown) {
  return error instanceof GoogleSignInError
    ? error.message
    : 'No pudimos conectar con Google. Revisa tu conexión y vuelve a intentarlo. (G00)';
}

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Supabase no está configurado');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) {
    throw new GoogleSignInError('No pudimos abrir el acceso con Google. Inténtalo nuevamente. (G01)');
  }

  const result = await openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return;

  const callback = new URL(result.url);
  if (callback.protocol !== 'traza:' || callback.host !== 'acceso' ||
      (callback.pathname !== '' && callback.pathname !== '/') || callback.username || callback.password) {
    throw new GoogleSignInError('El navegador no devolvió la sesión a TRAZA. (G02)');
  }
  const fragment = new URLSearchParams(callback.hash.slice(1));
  const providerError = callback.searchParams.get('error') ?? fragment.get('error');
  const providerCode = callback.searchParams.get('error_code') ?? fragment.get('error_code');
  if (providerError === 'access_denied' || providerCode === 'access_denied') {
    throw new GoogleSignInError('Google no autorizó el acceso. Si estás en la beta, revisa que tu correo esté entre los usuarios de prueba. (G03)');
  }
  if (providerError || providerCode) {
    throw new GoogleSignInError('El servicio de autenticación devolvió un error al conectar con Google. (G04)');
  }

  const code = callback.searchParams.get('code') ?? fragment.get('code');
  if (!code) throw new GoogleSignInError('El navegador volvió a TRAZA sin el código de acceso. (G05)');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    throw new GoogleSignInError('No se pudo confirmar la sesión con Google. Inicia el acceso de nuevo. (G06)');
  }
}
