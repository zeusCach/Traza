import { router, type Href } from 'expo-router';
import { ChevronRight, Info, LogOut, Monitor, Shield, Bell, Trash2, User, X, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserAvatar } from '@/components';
import { useSession } from '@/features/auth/SessionProvider';
import { radius, spacing, themedStyles, typography, useTheme } from '@/theme';

import { profileIdentity } from './profileIdentity';

const sections: { label: string; icon: LucideIcon; href: Href; destructive?: boolean }[] = [
  { label: 'Cuenta', icon: User, href: '/cuenta' },
  { label: 'Aspecto', icon: Monitor, href: '/aspecto' },
  { label: 'Controles de privacidad', icon: Shield, href: { pathname: '/cuenta', params: { seccion: 'privacidad' } } },
  { label: 'Notificaciones', icon: Bell, href: { pathname: '/cuenta', params: { seccion: 'notificaciones' } } },
  { label: 'Acerca de', icon: Info, href: { pathname: '/cuenta', params: { seccion: 'acerca' } } },
  { label: 'Eliminar cuenta', icon: Trash2, href: { pathname: '/cuenta', params: { seccion: 'eliminar' } }, destructive: true },
  { label: 'Cerrar sesión', icon: LogOut, href: { pathname: '/cuenta', params: { seccion: 'salir' } } },
];

export function ProfileMenu() {
  const session = useSession();
  const { colors } = useTheme();
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);
  if (!session) return null;
  const profile = profileIdentity(session.user);

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir menú de perfil"
        accessibilityState={{ expanded: open }} style={styles.iconButton} onPress={() => setOpen(true)}>
        <UserAvatar {...profile} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={closeMenu}>
        <View style={styles.overlay} accessibilityViewIsModal>
          <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <SafeAreaView style={styles.drawer}>
            <ScrollView contentContainerStyle={styles.content}>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar menú de perfil"
                style={[styles.iconButton, styles.close]} onPress={closeMenu}>
                <X size={24} color={colors.textPrimary} />
              </Pressable>
              <View style={styles.identity}>
                <UserAvatar {...profile} size="lg" />
                <Text style={styles.name}>{profile.name}</Text>
              </View>
              {sections.map(({ label, icon: Icon, href, destructive }) => (
                <Pressable key={label} accessibilityRole="button"
                  style={({ pressed }) => [styles.row, destructive && styles.divider, pressed && styles.pressed]}
                  onPress={() => {
                    closeMenu();
                    router.push(href);
                  }}>
                  <Icon size={20} color={destructive ? colors.error : colors.primary} />
                  <Text style={[styles.label, destructive && styles.danger]}>{label}</Text>
                  <ChevronRight size={16} color={colors.textSecondary} />
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  drawer: { flex: 1, width: '80%', maxWidth: 360, backgroundColor: colors.surface, borderRightWidth: 1, borderColor: colors.border },
  content: { padding: spacing.md },
  iconButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  close: { alignSelf: 'flex-end' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  name: { ...typography.subtitle, flex: 1, color: colors.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 54, padding: spacing.sm, borderRadius: radius.sm },
  pressed: { backgroundColor: colors.surfaceElevated },
  label: { ...typography.body, flex: 1, color: colors.textPrimary },
  danger: { color: colors.error },
  divider: { marginTop: spacing.sm, borderTopWidth: 1, borderColor: colors.border, borderRadius: 0 },
}));
