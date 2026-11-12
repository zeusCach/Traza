import { isRunningInExpoGo } from 'expo';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { appendRideLocations } from '@/database/rideDraft';

const taskName = 'traza.ride-location.v1';

export const rideLocationOptions: Location.LocationOptions = {
  accuracy: Location.Accuracy.High,
  distanceInterval: 0,
  timeInterval: 1_000,
};

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(taskName, async ({ data, error }) => {
  if (error) throw new Error(error.message);
  if (data?.locations.length) await appendRideLocations(data.locations, 'background');
});

export async function backgroundLocationAvailable() {
  return !isRunningInExpoGo() && await TaskManager.isAvailableAsync();
}

export function startBackgroundLocation() {
  return Location.startLocationUpdatesAsync(taskName, {
    ...rideLocationOptions,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'TRAZA · Rodada en curso',
      notificationBody: 'Registrando el recorrido mientras la pantalla está bloqueada.',
      killServiceOnDestroy: true,
    },
  });
}

export async function stopBackgroundLocation() {
  if (await backgroundLocationAvailable() && await Location.hasStartedLocationUpdatesAsync(taskName)) {
    await Location.stopLocationUpdatesAsync(taskName);
  }
}
