import '@/features/tracking/backgroundLocation';

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { ErrorState } from '@/components';
import { SessionProvider, useSession } from '@/features/auth/SessionProvider';
import { StartupLoader } from '@/features/auth/StartupLoader';
import { colors, trazaFonts } from '@/theme';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </SessionProvider>
  );
}

function AppNavigator() {
  const [fontsLoaded, fontError] = useFonts(trazaFonts);
  const session = useSession();
  const [showLoader, setShowLoader] = useState(true);
  const dismissLoader = useCallback(() => setShowLoader(false), []);
  const ready = fontsLoaded && session !== undefined;

  if (fontError) {
    return <ErrorState title="No pudimos preparar la aplicación" message={fontError.message} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {ready && (
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={showLoader}
          importantForAccessibility={showLoader ? 'no-hide-descendants' : 'auto'}
        >
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="index" options={{ animation: 'fade' }} />
              <Stack.Screen name="cuenta" />
              <Stack.Screen name="progreso" />
              <Stack.Screen name="actualizaciones" />
              <Stack.Screen name="activity/[id]" />
              <Stack.Screen name="feed/[id]" />
            </Stack.Protected>
            <Stack.Protected guard={!session}>
              <Stack.Screen name="bienvenida" options={{ animation: 'fade' }} />
              <Stack.Screen name="acceso" options={{ animation: 'fade' }} />
            </Stack.Protected>
          </Stack>
        </View>
      )}
      {showLoader && <StartupLoader ready={ready} onDismiss={dismissLoader} />}
    </View>
  );
}
