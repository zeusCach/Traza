import type { User } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, LoadingState } from '@/components';
import { supabase } from '@/database/supabase';
import { useSession } from '@/features/auth/SessionProvider';
import { colors, radius, spacing, typography } from '@/theme';

type Action = 'username' | 'residence' | 'password' | 'passwordCode' | 'delete' | 'signOut';

function metadataText(user: User, key: string) {
  const value: unknown = user.user_metadata[key];
  return typeof value === 'string' ? value : '';
}

export default function AccountScreen() {
  const session = useSession();

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppButton label="Volver" variant="ghost" size="md" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>Cuenta</Text>
          {session === undefined && <LoadingState message="Cargando cuenta…" />}
          {session && <AccountSettings key={session.user.id} user={session.user} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountSettings({ user }: { user: User }) {
  const [username, setUsername] = useState<string>();
  const [profileError, setProfileError] = useState(false);
  const [profileAttempt, setProfileAttempt] = useState(0);
  const [city, setCity] = useState(() => metadataText(user, 'city'));
  const [country, setCountry] = useState(() => metadataText(user, 'country'));
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [needsPasswordCode, setNeedsPasswordCode] = useState(false);
  const [passwordCode, setPasswordCode] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState<Action>();
  const [status, setStatus] = useState<{ action: Action; text: string }>();

  const fullName = [metadataText(user, 'first_name'), metadataText(user, 'last_name')].filter(Boolean).join(' ');

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data, error }) => {
      if (!active) return;
      if (error) setProfileError(true);
      else setUsername(data.display_name);
    });
    return () => { active = false; };
  }, [user.id, profileAttempt]);

  async function run(action: Action) {
    if (!supabase || busy) return;
    setBusy(action);
    setStatus(undefined);
    const show = (text: string) => setStatus({ action, text });

    try {
      switch (action) {
        case 'username': {
          if (!username?.trim()) return;
          const savedName = username.trim();
          const { error } = await supabase.from('profiles').update({ display_name: savedName })
            .eq('id', user.id).select('id').single();
          if (error) throw error;
          setUsername(savedName);
          show('Nombre de usuario actualizado.');
          break;
        }
        case 'residence': {
          const { error } = await supabase.auth.updateUser({ data: { city: city.trim(), country: country.trim() } });
          if (error) throw error;
          setCity(city.trim());
          setCountry(country.trim());
          show('Residencia actualizada.');
          break;
        }
        case 'password': {
          if (!currentPassword || !newPassword || newPassword !== confirmPassword) return;
          const { error } = await supabase.auth.updateUser({
            current_password: currentPassword,
            password: newPassword,
            ...(passwordCode.trim() ? { nonce: passwordCode.trim() } : {}),
          });
          if (error) {
            if (error.code === 'reauthentication_needed') {
              setNeedsPasswordCode(true);
              return show('Solicita un código por correo para cambiar tu contraseña.');
            }
            if (error.code === 'reauthentication_not_valid') return show('Revisa el código de verificación.');
            if (error.code === 'weak_password') return show('Elige una contraseña más segura.');
            if (error.code === 'same_password') return show('Elige una contraseña distinta a la actual.');
            if (error.code === 'invalid_credentials' || error.code === 'invalid_current_password') {
              return show('Revisa tu contraseña actual.');
            }
            throw error;
          }
          closePassword();
          show('Contraseña actualizada.');
          break;
        }
        case 'passwordCode': {
          const { error } = await supabase.auth.reauthenticate();
          if (error) throw error;
          show('Revisa tu correo para obtener el código de verificación.');
          break;
        }
        case 'delete': {
          if (deleteText !== 'ELIMINAR') return;
          const { error } = await supabase.rpc('delete_own_account');
          if (error) throw error;
          const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
          if (signOutError) show('Tu cuenta se eliminó. Vuelve a intentar cerrar sesión.');
          break;
        }
        case 'signOut': {
          const { error } = await supabase.auth.signOut({ scope: 'local' });
          if (error) throw error;
          break;
        }
      }
    } catch {
      const errors: Record<Action, string> = {
        username: 'No pudimos guardar tu nombre de usuario.',
        residence: 'No pudimos guardar tu residencia.',
        password: 'No pudimos cambiar tu contraseña.',
        passwordCode: 'No pudimos enviar el código de verificación.',
        delete: 'No pudimos confirmar la eliminación de tu cuenta.',
        signOut: 'No pudimos cerrar tu sesión.',
      };
      show(errors[action] + ' Vuelve a intentarlo.');
    } finally {
      setBusy(undefined);
    }
  }

  function closePassword() {
    setEditingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setNeedsPasswordCode(false);
    setPasswordCode('');
    setStatus(undefined);
  }

  function feedback(action: Action) {
    return status?.action === action && (
      <Text accessibilityLiveRegion="polite" style={styles.text}>{status.text}</Text>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Perfil</Text>
        {!!fullName && <Text style={styles.text}>{fullName}</Text>}
        {profileError ? (
          <>
            <Text style={styles.text}>No pudimos cargar tu nombre de usuario.</Text>
            <AppButton label="Reintentar" variant="secondary" onPress={() => {
              setProfileError(false);
              setProfileAttempt(attempt => attempt + 1);
            }} />
          </>
        ) : username === undefined ? (
          <LoadingState message="Cargando perfil…" />
        ) : (
          <>
            <Field label="Nombre de usuario" value={username} onChangeText={setUsername}
              autoComplete="username" maxLength={80} editable={!busy} />
            <AppButton label="Guardar nombre de usuario" loading={busy === 'username'}
              disabled={!!busy || !username.trim()} onPress={() => void run('username')} />
            {feedback('username')}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Lugar de residencia</Text>
        <Field label="Ciudad (opcional)" value={city} onChangeText={setCity}
          autoCapitalize="words" maxLength={100} editable={!busy} />
        <Field label="País (opcional)" value={country} onChangeText={setCountry}
          autoCapitalize="words" maxLength={100} editable={!busy} />
        <AppButton label="Guardar residencia" loading={busy === 'residence'}
          disabled={!!busy} onPress={() => void run('residence')} />
        {feedback('residence')}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Suscripción</Text>
        <Text style={styles.text}>Próximamente</Text>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Inicio de sesión</Text>
        <Text style={styles.label}>Correo electrónico</Text>
        <Text style={styles.text}>{user.email}</Text>
        {editingPassword ? (
          <>
            <Field label="Contraseña actual" secureTextEntry autoComplete="current-password"
              value={currentPassword} onChangeText={setCurrentPassword} editable={!busy} />
            <Field label="Nueva contraseña" secureTextEntry autoComplete="new-password"
              value={newPassword} onChangeText={setNewPassword} editable={!busy} />
            <Field label="Confirma la nueva contraseña" secureTextEntry autoComplete="new-password"
              value={confirmPassword} onChangeText={setConfirmPassword} editable={!busy} />
            {!!confirmPassword && newPassword !== confirmPassword && (
              <Text style={styles.danger}>Las contraseñas no coinciden.</Text>
            )}
            {needsPasswordCode && (
              <>
                <AppButton label="Enviar código por correo" variant="secondary"
                  loading={busy === 'passwordCode'} disabled={!!busy} onPress={() => void run('passwordCode')} />
                {feedback('passwordCode')}
                <Field label="Código de verificación" autoComplete="one-time-code" keyboardType="number-pad"
                  value={passwordCode} onChangeText={setPasswordCode} editable={!busy} />
              </>
            )}
            <AppButton label="Guardar contraseña" loading={busy === 'password'}
              disabled={!!busy || !currentPassword || !newPassword || newPassword !== confirmPassword
                || (needsPasswordCode && !passwordCode.trim())}
              onPress={() => void run('password')} />
            <AppButton label="Cancelar" variant="ghost" disabled={!!busy} onPress={closePassword} />
          </>
        ) : (
          <AppButton label="Cambiar contraseña" variant="secondary" disabled={!!busy} onPress={() => {
            setStatus(undefined);
            setEditingPassword(true);
          }} />
        )}
        {feedback('password')}
        <AppButton label="Cerrar sesión" variant="secondary" loading={busy === 'signOut'}
          disabled={!!busy} onPress={() => void run('signOut')} />
        {feedback('signOut')}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={[styles.heading, styles.danger]}>Eliminar cuenta</Text>
        {confirmDelete ? (
          <>
            <Text style={styles.text}>Se eliminarán permanentemente tu cuenta y las rutas, publicaciones y guardados asociados en línea.</Text>
            <Field label="Escribe ELIMINAR para confirmar" value={deleteText}
              onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} editable={!busy} />
            <AppButton label="Eliminar definitivamente" variant="secondary" loading={busy === 'delete'}
              disabled={!!busy || deleteText !== 'ELIMINAR'} onPress={() => void run('delete')} />
            <AppButton label="Cancelar" variant="ghost" disabled={!!busy} onPress={() => {
              setConfirmDelete(false);
              setDeleteText('');
              setStatus(undefined);
            }} />
          </>
        ) : (
          <AppButton label="Eliminar cuenta" variant="secondary" disabled={!!busy} onPress={() => setConfirmDelete(true)} />
        )}
        {feedback('delete')}
      </View>
    </>
  );
}

function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.lg, gap: spacing.md },
  section: {
    backgroundColor: colors.surface, borderRadius: radius.md, borderColor: colors.border,
    borderWidth: 1, padding: spacing.md, gap: spacing.sm,
  },
  field: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  heading: { ...typography.title, color: colors.textPrimary, fontSize: 20, lineHeight: 26 },
  text: { ...typography.body, color: colors.textPrimary },
  label: { ...typography.label, color: colors.textSecondary },
  danger: { color: colors.error },
  input: {
    ...typography.body, color: colors.textPrimary, backgroundColor: colors.background,
    borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, minHeight: 48, paddingHorizontal: spacing.md,
  },
});
