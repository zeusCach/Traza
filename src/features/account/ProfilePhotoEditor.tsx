import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton, UserAvatar } from '@/components';
import { spacing, themedStyles, typography } from '@/theme';

import { useProfilePhoto } from './ProfilePhotoProvider';

export function ProfilePhotoEditor({ name, imageUri }: { name: string; imageUri?: string }) {
  const { photo, retry, save, currentImage } = useProfilePhoto(imageUri);
  const styles = useStyles();
  const running = useRef(false);
  const [busy, setBusy] = useState<'upload' | 'remove'>();
  const [message, setMessage] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  async function upload() {
    if (running.current) return;
    running.current = true;
    setBusy('upload');
    setMessage('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: Platform.OS !== 'web',
        aspect: [1, 1],
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error('Imagen no disponible');

      const context = ImageManipulator.manipulate(asset.uri);
      try {
        if (Math.max(asset.width, asset.height) > 512) {
          context.resize(asset.width >= asset.height ? { width: 512 } : { height: 512 });
        }
        const image = await context.renderAsync();
        try {
          const { base64 } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.78, base64: true });
          if (!base64 || base64.length > 350000) throw new Error('Tamaño de imagen no admitido');
          await save(base64);
          setMessage('Foto actualizada.');
        } finally {
          image.release();
        }
      } finally {
        context.release();
      }
    } catch {
      setMessage('No pudimos guardar tu foto. Elige otra imagen o vuelve a intentarlo.');
    } finally {
      running.current = false;
      setBusy(undefined);
    }
  }

  async function remove() {
    if (running.current) return;
    running.current = true;
    setBusy('remove');
    setMessage('');
    try {
      await save(null);
      setConfirmRemove(false);
      setMessage('Foto eliminada.');
    } catch {
      setMessage('No pudimos quitar tu foto. Vuelve a intentarlo.');
    } finally {
      running.current = false;
      setBusy(undefined);
    }
  }

  return (
    <View style={styles.editor}>
      <View style={styles.header}>
        <UserAvatar name={name} size="lg" imageUri={currentImage} />
        <View style={styles.description}>
          <Text style={styles.label}>Foto de perfil</Text>
          <Text style={styles.text}>{name}</Text>
        </View>
      </View>
      {photo.status === 'loading' && <Text style={styles.text}>Cargando foto…</Text>}
      {photo.status === 'error' && (
        <>
          <Text style={styles.text}>No pudimos cargar tu foto.</Text>
          <AppButton label="Reintentar" variant="secondary" onPress={retry} />
        </>
      )}
      {photo.status === 'ready' && (confirmRemove ? (
        <>
          <Text style={styles.text}>¿Quieres quitar tu foto de perfil?</Text>
          <AppButton label="Quitar foto" variant="secondary" loading={busy === 'remove'}
            onPress={() => void remove()} />
          <AppButton label="Cancelar" variant="ghost" disabled={!!busy} onPress={() => setConfirmRemove(false)} />
        </>
      ) : (
        <>
          <AppButton label={currentImage ? 'Cambiar foto' : 'Elegir foto'} icon={Camera} variant="secondary"
            loading={busy === 'upload'} onPress={() => void upload()} />
          {!!currentImage && <AppButton label="Quitar foto" variant="ghost" disabled={!!busy} onPress={() => {
            setMessage('');
            setConfirmRemove(true);
          }} />}
        </>
      ))}
      {!!message && <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>}
    </View>
  );
}

const useStyles = themedStyles(colors => StyleSheet.create({
  editor: { gap: spacing.sm, paddingBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  description: { flex: 1, gap: spacing.xs },
  label: { ...typography.subtitle, color: colors.textPrimary },
  text: { ...typography.bodySmall, color: colors.textSecondary },
}));
