import type { User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, LoadingState } from '@/components';
import { supabase } from '@/database/supabase';
import { metadataText, profileIdentity } from '@/features/account/profileIdentity';
import { ProfilePhotoEditor } from '@/features/account/ProfilePhotoEditor';
import { useSession } from '@/features/auth/SessionProvider';
import { radius, spacing, typography, themedStyles } from '@/theme';

type Action = 'username' | 'residence' | 'password' | 'passwordCode' | 'delete' | 'signOut';

const sectionTitles = {
  cuenta: 'Cuenta',
  privacidad: 'Controles de privacidad',
  notificaciones: 'Notificaciones',
  acerca: 'Acerca de TRAZA',
  eliminar: 'Eliminar cuenta',
  salir: 'Cerrar sesión',
} as const;

type Section = keyof typeof sectionTitles;

export default function AccountScreen() {
  const styles = useStyles();
  const session = useSession();
  const { seccion } = useLocalSearchParams<{ seccion?: string }>();
  const section = seccion && Object.prototype.hasOwnProperty.call(sectionTitles, seccion) ? seccion as Section : 'cuenta';
  const [settingsError, setSettingsError] = useState(false);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/', params: { section: 'tu' } });
  }

  function openSettings() {
    setSettingsError(false);
    void Linking.openSettings().catch(() => setSettingsError(true));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppButton label="Volver" variant="ghost" size="md" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>{sectionTitles[section]}</Text>
          {session === undefined && <LoadingState message="Cargando cuenta…" />}
          {session && (section === 'cuenta' || section === 'eliminar' || section === 'salir') && (
            <AccountSettings key={session.user.id + section} user={session.user} section={section} />
          )}
          {section === 'privacidad' && (
            <View style={styles.section}>
              <Text style={styles.text}>Al publicar una rodada, tu nombre de usuario y la ruta quedan visibles para otros ciclistas del feed.</Text>
              <Text style={styles.text}>Puedes retirar una publicación desde el detalle de la rodada. Tu correo y tu residencia son privados.</Text>
              {Platform.OS !== 'web' && (
                <AppButton label="Permisos de ubicación" variant="secondary" onPress={openSettings} />
              )}
            </View>
          )}
          {section === 'notificaciones' && (
            <View style={styles.section}>
              <Text style={styles.text}>Gestiona los permisos de notificaciones de TRAZA en los ajustes del dispositivo.</Text>
              {Platform.OS !== 'web' && (
                <AppButton label="Abrir ajustes del dispositivo" variant="secondary" onPress={openSettings} />
              )}
            </View>
          )}
          {settingsError && <Text accessibilityLiveRegion="polite" style={styles.danger}>No pudimos abrir los ajustes.</Text>}
          {section === 'acerca' && (
            <View style={styles.section}>
              {Constants.expoConfig?.version && <Text style={styles.text}>Versión {Constants.expoConfig.version}</Text>}
              <AppButton label="Actualizaciones" variant="secondary" onPress={() => router.push('/actualizaciones')} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AccountSettings({ user, section }: { user: User; section: 'cuenta' | 'eliminar' | 'salir' }) {
  const styles = useStyles();
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
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState<Action>();
  const [status, setStatus] = useState<{ action: Action; text: string }>();


  useEffect(() => {
    if (!supabase || section !== 'cuenta') return;
    let active = true;
    void supabase.from('profiles').select('display_name').eq('id', user.id).single().then(({ data, error }) => {
      if (!active) return;
      if (error) setProfileError(true);
      else setUsername(data.display_name);
    });
    return () => { active = false; };
  }, [user.id, profileAttempt, section]);

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

  if (section === 'eliminar') {
    return (
      <View style={styles.section}>
        <Text style={styles.text}>Se eliminarán permanentemente tu cuenta y las rutas, publicaciones y guardados asociados en línea.</Text>
        <Field label="Escribe ELIMINAR para confirmar" value={deleteText}
          onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} editable={!busy} />
        <AppButton label="Eliminar definitivamente" variant="secondary" loading={busy === 'delete'}
          disabled={!!busy || deleteText !== 'ELIMINAR'} onPress={() => void run('delete')} />
        {feedback('delete')}
      </View>
    );
  }

  if (section === 'salir') {
    return (
      <View style={styles.section}>
        <Text style={styles.text}>{user.email}</Text>
        <AppButton label="Cerrar sesión" variant="secondary" loading={busy === 'signOut'}
          disabled={!!busy} onPress={() => void run('signOut')} />
        {feedback('signOut')}
      </View>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>Perfil</Text>
        <ProfilePhotoEditor {...profileIdentity(user)} />
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
      </View>
    </>
  );
}

function Field({ label, ...props }: TextInputProps & { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} style={styles.input} />
    </View>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
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
}));
