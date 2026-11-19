import { Link } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RouteBackdrop } from '@/features/auth/RouteBackdrop';
import { radius, spacing, typography, useTheme, themedStyles } from '@/theme';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.screen}>
      <RouteBackdrop />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>TRAZA</Text>
        <View style={styles.hero}>
          <Text accessibilityRole="header" style={styles.title}>
            Inicia tu mundo de <Text style={styles.accent}>aventuras</Text>
          </Text>
        </View>
        <View style={styles.actions}>
          <Link href="/acceso" style={styles.primary}>
            Iniciar sesión <ArrowRight size={18} color={colors.background} />
          </Link>
          <View style={styles.social}>
            {Platform.OS !== 'web' && (
              <Link href="/acceso" style={[styles.provider, styles.providerName, styles.googleLink]}>
                Acceso con Google
              </Link>
            )}
            <View accessible accessibilityLabel="Facebook, próximamente" style={styles.provider}>
              <Text style={styles.providerName}>Facebook</Text>
              <Text style={styles.caption}>Próximamente</Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.caption}>¿No tienes cuenta?</Text>
            <Link href={{ pathname: '/acceso', params: { modo: 'registro' } }} style={styles.register}>
              Registrarme
            </Link>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  brand: { ...typography.subtitle, color: '#FFFFFF', letterSpacing: 4 },
  hero: { flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xxxl },
  title: { ...typography.display, color: colors.textPrimary, maxWidth: 340 },
  accent: { color: colors.primary },
  actions: { gap: spacing.md },
  primary: {
    ...typography.button,
    color: colors.background,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    textAlign: 'center',
    padding: spacing.md,
  },
  social: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  provider: {
    flexGrow: 1,
    flexBasis: 120,
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  providerName: { ...typography.label, color: colors.textPrimary },
  googleLink: { textAlign: 'center', minHeight: 48, textAlignVertical: 'center' },
  caption: { ...typography.bodySmall, color: colors.textSecondary },
  footer: { alignItems: 'center' },
  register: { ...typography.button, color: colors.primary, padding: spacing.sm, minHeight: 48 },
}));
