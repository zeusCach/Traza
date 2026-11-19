import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase } from '@/database/supabase';
import { useSession } from '@/features/auth/SessionProvider';

type PhotoState = { status: 'loading' | 'error' } | { status: 'ready'; imageUri?: string; hasPreference: boolean };
type ProfilePhoto = {
  photo: PhotoState;
  retry: () => void;
  save: (jpeg: string | null) => Promise<void>;
};

const ProfilePhotoContext = createContext<ProfilePhoto | null>(null);

export function ProfilePhotoProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  const userId = session?.user.id;
  const [record, setRecord] = useState<{ userId?: string; photo: PhotoState }>();
  const [attempt, setAttempt] = useState(0);
  const pendingWrites = useRef(new Set<string>());
  const photo: PhotoState = record && record.userId === userId ? record.photo : { status: 'loading' };

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    void supabase.from('profile_photos').select('jpeg_base64').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setRecord({
          userId,
          photo: error
            ? { status: 'error' }
            : { status: 'ready', imageUri: imageUri(data?.jpeg_base64), hasPreference: !!data },
        });
      });
    return () => { active = false; };
  }, [attempt, userId]);

  function retry() {
    setRecord({ userId, photo: { status: 'loading' } });
    setAttempt(current => current + 1);
  }

  async function save(jpeg: string | null) {
    if (!supabase || !userId) throw new Error('Sesión no disponible');
    const writes = pendingWrites.current;
    if (writes.has(userId)) throw new Error('Ya hay un cambio en curso');
    writes.add(userId);
    try {
      const { error } = await supabase.from('profile_photos')
        .upsert({ user_id: userId, jpeg_base64: jpeg }, { onConflict: 'user_id' });
      if (error) throw error;
      setRecord(current => current?.userId === userId
        ? { userId, photo: { status: 'ready', imageUri: imageUri(jpeg), hasPreference: true } }
        : current);
    } finally {
      writes.delete(userId);
    }
  }

  return <ProfilePhotoContext.Provider value={{ photo, retry, save }}>{children}</ProfilePhotoContext.Provider>;
}

function imageUri(jpeg?: string | null) {
  return jpeg ? 'data:image/jpeg;base64,' + jpeg : undefined;
}

export function useProfilePhoto(fallback?: string) {
  const value = useContext(ProfilePhotoContext);
  if (!value) throw new Error('ProfilePhotoProvider is missing');
  const { photo } = value;
  return { ...value, currentImage: photo.status === 'ready' && photo.hasPreference ? photo.imageUri : fallback };
}
