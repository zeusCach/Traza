import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { loadFeed, updateFeed } from './feedStorage';

export function useFeed() {
  const [state, setState] = useState<Awaited<ReturnType<typeof loadFeed>> | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const writing = useRef(false);

  useFocusEffect(useCallback(() => {
    setAttempt(value => value + 1);
  }, []));

  useEffect(() => {
    if (!attempt) return;
    let active = true;
    loadFeed().then(value => {
      if (active) {
        setState(value);
        setError(false);
      }
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [attempt]);

  async function change(update: Parameters<typeof updateFeed>[0]) {
    if (writing.current) return;
    writing.current = true;
    setBusy(true);
    try {
      setState(await updateFeed(update));
      setError(false);
    } catch {
      setError(true);
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return { state, error, busy, change, retry: () => setAttempt(value => value + 1) };
}
