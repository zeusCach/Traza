import { User } from 'lucide-react-native';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamily, sizes } from '@/theme';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

export interface UserAvatarProps {
  name?: string;
  imageUri?: string;
  size?: UserAvatarSize;
}

const dimension: Record<UserAvatarSize, number> = {
  sm: sizes.avatarSm,
  md: sizes.avatarMd,
  lg: sizes.avatarLg,
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

export function UserAvatar({ name, imageUri, size = 'md' }: UserAvatarProps) {
  const diameter = dimension[size];
  const containerStyle = { width: diameter, height: diameter, borderRadius: diameter / 2 };
  const initials = name ? getInitials(name) : '';

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        accessibilityLabel={name ? `Avatar de ${name}` : 'Avatar'}
        style={[styles.container, containerStyle]}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={name ? `Avatar de ${name}` : 'Avatar'}
      style={[styles.container, styles.fallback, containerStyle]}
    >
      {initials ? (
        <Text style={[styles.initials, { fontSize: diameter * 0.36 }]}>{initials}</Text>
      ) : (
        <User size={diameter * 0.5} color={colors.primary} strokeWidth={2} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fontFamily.bold,
    color: colors.primary,
  },
});