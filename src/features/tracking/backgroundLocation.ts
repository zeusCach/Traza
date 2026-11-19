import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendRideLocations } from '@/database/rideDraft';

const taskName = 'traza.ride-location.v1';
const recordingAccountKey = 'traza.ride-location.account';

export const rideLocationOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 0,
  timeInterval: 1_000,
};

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(taskName, async ({ data, error }) => {
  if (error) throw new Error(error.message);
  if (!data?.locations.length) return;
  const accountId = await AsyncStorage.getItem(recordingAccountKey);
  if (accountId) await appendRideLocations(accountId, data.locations, 'background');
});

export async function backgroundLocationAvailable() {
  return !isRunningInExpoGo() && await TaskManager.isAvailableAsync();
}

export async function startBackgroundLocation(accountId: string) {
  await AsyncStorage.setItem(recordingAccountKey, accountId);
  return Location.startLocationUpdatesAsync(taskName, {
    ...rideLocationOptions,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TRAZA · Rodada en curso',
      notificationBody: 'Registrando el recorrido mientras la pantalla está bloqueada.',
      killServiceOnDestroy: false,
    },
  });
}

export async function isBackgroundLocationRegistered(accountId?: string) {
  if (accountId && await AsyncStorage.getItem(recordingAccountKey) !== accountId) return false;
  return (await backgroundLocationAvailable()) && await Location.hasStartedLocationUpdatesAsync(taskName);
}

export async function stopBackgroundLocation() {
  if (await isBackgroundLocationRegistered()) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
  await AsyncStorage.removeItem(recordingAccountKey);
}
