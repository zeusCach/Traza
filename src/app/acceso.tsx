import { router, useLocalSearchParams } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components';
import { supabase } from '@/database/supabase';
import { googleSignInMessage, signInWithGoogle } from '@/features/auth/googleSignIn';
import { RouteBackdrop } from '@/features/auth/RouteBackdrop';
import { radius, spacing, typography, themedStyles, useTheme } from '@/theme';

export default function AccessScreen() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();

  return <AccessForm key={modo} initialRegister={modo === 'registro'} />;
}

function AccessForm({ initialRegister }: { initialRegister: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [register, setRegister] = useState(initialRegister);
  const [pending, setPending] = useState<'email' | 'google' | null>(null);
  const busy = pending !== null;
  const [message, setMessage] = useState('');
  const canSubmit = !!email.trim() && !!password && (!register || (!!firstName.trim() && !!lastName.trim()));

  async function submit() {
    if (!supabase || busy || !canSubmit) return;
    setPending('email');
    setMessage('');
    try {
      const credentials = { email: email.trim(), password };
      const { data, error } = register
        ? await supabase.auth.signUp({
          ...credentials,
          options: { data: { first_name: firstName.trim(), last_name: lastName.trim() } },
        })
        : await supabase.auth.signInWithPassword(credentials);

      if (error) throw error;
      if (!data.session && register) {
        setPassword('');
        setPasswordVisible(false);
        setRegister(false);
        setMessage('Revisa tu correo para confirmar tu cuenta y después inicia sesión.');
      }
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
      if (code === 'invalid_credentials') setMessage('Revisa tu correo y contraseña.');
      else if (code === 'email_not_confirmed') setMessage('Confirma tu correo antes de iniciar sesión.');
      else if (code === 'weak_password') setMessage('Elige una contraseña más segura.');
      else setMessage('No pudimos completar la solicitud. Vuelve a intentarlo.');
    } finally {
      setPending(null);
    }
  }

  async function continueWithGoogle() {
    if (!supabase || busy) return;
    setPending('google');
    setMessage('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(googleSignInMessage(error));
    } finally {
      setPending(null);
    }
  }

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/bienvenida');
  }

  return (
    <SafeAreaView style={styles.screen}>
      <RouteBackdrop />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppButton label="Volver" variant="ghost" size="md" disabled={busy} onPress={goBack} />
          <Text accessibilityRole="header" style={styles.title}>
            {register ? 'Crea tu cuenta' : 'Inicia sesión'}
          </Text>
          {register && (
            <>
              <Text style={styles.label}>Nombre</Text>
              <TextInput accessibilityLabel="Nombre" autoComplete="given-name" autoCapitalize="words"
                value={firstName} onChangeText={setFirstName} maxLength={80} editable={!busy} style={styles.input} />
              <Text style={styles.label}>Apellido</Text>
              <TextInput accessibilityLabel="Apellido" autoComplete="family-name" autoCapitalize="words"
                value={lastName} onChangeText={setLastName} maxLength={80} editable={!busy} style={styles.input} />
            </>
          )}
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            accessibilityLabel="Correo electrónico"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
            style={styles.input}
          />
          <Text style={styles.label}>Contraseña</Text>
          <View style={[styles.inputFrame, styles.passwordRow]}>
            <TextInput
              accessibilityLabel="Contraseña"
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete={register ? 'new-password' : 'current-password'}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              onSubmitEditing={() => void submit()}
              style={[styles.inputText, styles.passwordInput]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={() => setPasswordVisible(visible => !visible)}
              style={({ pressed }) => [styles.visibilityButton, pressed && styles.pressed]}
            >
              {passwordVisible ? <EyeOff size={22} color={colors.textSecondary} /> : <Eye size={22} color={colors.textSecondary} />}
            </Pressable>
          </View>
          <AppButton
            label={register ? 'Crear cuenta' : 'Iniciar sesión'}
            loading={pending === 'email'}
            disabled={!supabase || !canSubmit || busy}
            onPress={() => void submit()}
          />
          {Platform.OS !== 'web' && (
            <AppButton
              label="Continuar con Google"
              variant="secondary"
              loading={pending === 'google'}
              disabled={!supabase || busy}
              onPress={() => void continueWithGoogle()}
            />
          )}
          <AppButton
            label={register ? 'Ya tengo cuenta' : 'Crear una cuenta'}
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setRegister(!register);
              setPassword('');
              setPasswordVisible(false);
              setMessage('');
            }}
          />
          {!supabase && <Text style={styles.label}>Supabase aún no está configurado.</Text>}
          {!!message && <Text accessibilityLiveRegion="polite" style={styles.label}>{message}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles(colors => {
  const inputText = {
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  };
  const inputFrame = {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  };

  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.surface },
    keyboard: { flex: 1 },
    content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.xl, gap: spacing.sm },
    title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.md },
    label: { ...typography.label, color: colors.textPrimary },
    input: { ...inputFrame, ...inputText },
    inputFrame,
    inputText,
    passwordRow: { flexDirection: 'row', alignItems: 'center' },
    passwordInput: { flex: 1, minWidth: 0 },
    visibilityButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
    pressed: { opacity: 0.65 },
  });
});
