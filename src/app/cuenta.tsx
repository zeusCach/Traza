import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, LoadingState } from '@/components';
import { supabase } from '@/database/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { colors, radius, spacing, typography } from '@/theme';

export default function AccountScreen() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const accountId = session?.user.id;
  const [profile, setProfile] = useState<{ accountId: string; name: string }>();
  const name = profile?.accountId === accountId ? profile?.name : undefined;

  useEffect(() => {
    if (!supabase || !accountId) return;
    let active = true;
    supabase.from('profiles').select('display_name').eq('id', accountId).single().then(({ data, error }) => {
      if (!active) return;
      if (data) setProfile({ accountId, name: data.display_name });
      if (error) setMessage('No pudimos cargar tu nombre de perfil.');
    });
    return () => { active = false; };
  }, [accountId]);

  async function saveName() {
    if (!supabase || !accountId || !name?.trim() || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', accountId);
      if (error) throw error;
      setMessage('Nombre actualizado.');
    } catch {
      setMessage('No pudimos guardar tu nombre. Vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch {
      setMessage('No pudimos cerrar tu sesión. Vuelve a intentarlo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppButton label="Volver" variant="ghost" size="md" onPress={close} />
        <Text accessibilityRole="header" style={styles.title}>Cuenta</Text>
        {!supabase ? <Text style={styles.text}>Supabase aún no está configurado.</Text> : session === undefined ? (
          <LoadingState message="Cargando cuenta…" />
        ) : session && accountId ? (
          <>
            <Text style={styles.text}>{session.user.email}</Text>
            <TextInput accessibilityLabel="Nombre visible en el feed" placeholder="Nombre visible en el feed"
              maxLength={80} value={name ?? ''} onChangeText={value => setProfile({ accountId, name: value })}
              editable={!busy} style={styles.input} placeholderTextColor={colors.textSecondary} />
            <AppButton label="Guardar nombre" disabled={busy || !name?.trim()} onPress={() => void saveName()} />
            <AppButton label="Cerrar sesión" variant="secondary" disabled={busy} onPress={() => void signOut()} />
          </>
        ) : null}
        {!!message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textPrimary },
  input: {
    ...typography.body, color: colors.textPrimary, borderColor: colors.border,
    borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: spacing.md,
  },
});
