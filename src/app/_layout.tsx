import '@/features/tracking/backgroundLocation';

import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';

import { ErrorState, LoadingState } from '@/components';
import { colors, trazaFonts } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(trazaFonts);

  if (fontError) {
    return <ErrorState title="No pudimos preparar la aplicación" message={fontError.message} />;
  }

  if (!fontsLoaded) {
    return <LoadingState message="Preparando TRAZA…" />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}
