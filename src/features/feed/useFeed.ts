import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useSession } from '@/features/auth/SessionProvider';

import { loadFeed, updateFeed } from './feedStorage';
import { loadRemoteFeed, setLocalTraces, setRemoteSaved, type FeedQuery } from './remoteFeed';

export function useFeed(query: FeedQuery = 'recent', enabled = true) {
  const session = useSession();
  const ready = session !== undefined;
  const accountId = session?.user.id;
  const key = `${accountId ?? 'guest'}:${query}`;
  const [result, setResult] = useState<{
    key: string;
    state?: Awaited<ReturnType<typeof loadFeed>>;
    error?: boolean;
  }>();
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const writing = useRef(false);
  const version = useRef(0);
  const load = useCallback(() => accountId ? loadRemoteFeed(accountId, query) : loadFeed(), [accountId, query]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const state = ready && result?.key === key ? result.state ?? null : null;
  const error = ready && result?.key === key && !!result.error;

  useFocusEffect(retry);

  useEffect(() => {
    return () => { version.current += 1; };
  }, [key]);

  useEffect(() => {
    if (!attempt || !enabled || !ready) return;
    let active = true;
    const currentVersion = version.current;
    load().then(value => {
      if (active && currentVersion === version.current) setResult({ key, state: value });
    }).catch(() => {
      if (active && currentVersion === version.current) setResult({ key, error: true });
    });
    return () => { active = false; };
  }, [attempt, enabled, key, load, ready]);

  async function run(operation: () => Promise<unknown>) {
    if (writing.current) return;
    writing.current = true;
    const currentVersion = ++version.current;
    setBusy(true);
    try {
      await operation();
      if (currentVersion !== version.current) return;
      const value = await load();
      if (currentVersion === version.current) setResult({ key, state: value });
    } catch {
      if (currentVersion === version.current) setResult({ key, error: true });
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  function change(update: Parameters<typeof updateFeed>[0]) {
    if (!state) return;
    return run(async () => {
      if (!accountId) {
        await updateFeed(update);
        return;
      }
      const next = update(state);
      const added = next.saved.find(id => !state.saved.includes(id));
      const removed = state.saved.find(id => !next.saved.includes(id));
      if (added) await setRemoteSaved(accountId, added, true);
      if (removed) await setRemoteSaved(accountId, removed, false);
      if (next.traced !== state.traced) await setLocalTraces(accountId, next.traced);
    });
  }

  return { state, error, busy, change, retry, run, accountId };
}
