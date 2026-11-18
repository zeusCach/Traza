import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components';
import { supabase } from '@/database/supabase';
import { RouteBackdrop } from '@/features/auth/RouteBackdrop';
import { colors, radius, spacing, typography } from '@/theme';

export default function AccessScreen() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();

  return <AccessForm key={modo} initialRegister={modo === 'registro'} />;
}

function AccessForm({ initialRegister }: { initialRegister: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [register, setRegister] = useState(initialRegister);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const canSubmit = !!email.trim() && !!password && (!register || (!!firstName.trim() && !!lastName.trim()));

  async function submit() {
    if (!supabase || busy || !canSubmit) return;
    setBusy(true);
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
      setBusy(false);
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
          <AppButton label="Volver" variant="ghost" size="md" onPress={goBack} />
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
          <TextInput
            accessibilityLabel="Contraseña"
            secureTextEntry
            autoComplete={register ? 'new-password' : 'current-password'}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
          <AppButton
            label={register ? 'Crear cuenta' : 'Iniciar sesión'}
            loading={busy}
            disabled={!supabase || !canSubmit}
            onPress={() => void submit()}
          />
          <AppButton
            label={register ? 'Ya tengo cuenta' : 'Crear una cuenta'}
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setRegister(!register);
              setPassword('');
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  keyboard: { flex: 1 },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.xl, gap: spacing.sm },
  title: { ...typography.display, color: colors.textPrimary, marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textPrimary },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    minHeight: 48,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
});
