import '@/features/tracking/backgroundLocation';

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components';
import { ProfilePhotoProvider } from '@/features/account/ProfilePhotoProvider';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { StartupLoader } from '@/features/auth/StartupLoader';
import { ThemeProvider, trazaFonts, useTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ProfilePhotoProvider>
          <AppNavigator />
        </ProfilePhotoProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}

function AppNavigator() {
  const { colors, scheme, ready: themeReady } = useTheme();

  const [fontsLoaded, fontError] = useFonts(trazaFonts);
  const session = useSession();
  const [showLoader, setShowLoader] = useState(true);
  const dismissLoader = useCallback(() => setShowLoader(false), []);
  const ready = fontsLoaded && themeReady && session !== undefined;

  if (fontError) {
    return <ErrorState title="No pudimos preparar la aplicación" message={fontError.message} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {ready && (
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={showLoader}
          importantForAccessibility={showLoader ? 'no-hide-descendants' : 'auto'}
        >
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={!!session} redirectTo="/bienvenida">
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="cuenta" />
              <Stack.Screen name="aspecto" />
              <Stack.Screen name="progreso" />
              <Stack.Screen name="actualizaciones" />
              <Stack.Screen name="activity/[id]" />
              <Stack.Screen name="feed/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!session} redirectTo="/">
              <Stack.Screen name="bienvenida" options={{ animation: 'fade' }} />
            </Stack.Protected>
            {/* Send any restored credentials route to welcome during startup. */}
            <Stack.Protected guard={!session && !showLoader} redirectTo={session ? '/' : '/bienvenida'}>
              <Stack.Screen name="acceso" options={{ animation: 'fade' }} />
            </Stack.Protected>
          </Stack>
        </View>
      )}
      {showLoader && <StartupLoader ready={ready} onDismiss={dismissLoader} />}
    </View>
  );
}
