import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { supabase } from '@/database/supabase';

const SessionContext = createContext<Session | null | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const { data } = client.auth.onAuthStateChange((_event, value) => setSession(value));
    if (Platform.OS === 'web') return () => data.subscription.unsubscribe();

    function refreshForState(state: string) {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    }

    refreshForState(AppState.currentState ?? 'active');
    const subscription = AppState.addEventListener('change', refreshForState);
    return () => {
      data.subscription.unsubscribe();
      subscription.remove();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
