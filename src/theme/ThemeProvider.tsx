import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type Palette } from './colors';

export type AppearancePreference = 'system' | 'light' | 'dark';
const storageKey = 'traza.appearance';

const ThemeContext = createContext<{
  ready: boolean;
  preference: AppearancePreference;
  systemScheme: 'light' | 'dark';
  scheme: 'light' | 'dark';
  colors: Palette;
  savePreference: (value: AppearancePreference) => Promise<void>;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme: 'light' | 'dark' = useColorScheme() === 'light' ? 'light' : 'dark';
  const [preference, setPreference] = useState<AppearancePreference>('dark');
  const [ready, setReady] = useState(false);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(storageKey).then(stored => {
      if (active && (stored === 'system' || stored === 'dark' || stored === 'light')) setPreference(stored);
    }).catch(() => {}).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const theme = useMemo(() => {
    const scheme = preference === 'system' ? systemScheme : preference;
    return {
      ready, preference, scheme, systemScheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      savePreference(value: AppearancePreference) {
        const write = writes.current.then(async () => {
          await AsyncStorage.setItem(storageKey, value);
          setPreference(value);
        });
        writes.current = write.catch(() => {});
        return write;
      },
    };
  }, [preference, ready, systemScheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('ThemeProvider is missing');
  return theme;
}

export function themedStyles<T>(create: (palette: Palette) => T) {
  const light = create(lightColors);
  const dark = create(darkColors);
  return function useStyles() {
    return useTheme().scheme === 'light' ? light : dark;
  };
}
