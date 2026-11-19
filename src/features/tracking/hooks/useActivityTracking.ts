import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { loadActivities } from '@/database/activities';
import {
  appendRideLocations,
  beginRideSegment,
  checkpointRide,
  clearRideDraft,
  loadDraftRoute,
  loadRideDraft,
  pauseRideDraft,
  rideElapsedMs,
  setSegmentToForeground,
  type RecordingMode,
  type RideDraft,
} from '@/database/rideDraft';

import {
  backgroundLocationAvailable,
  isBackgroundLocationRegistered,
  rideLocationOptions,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '../backgroundLocation';

const speedMaxAgeMs = 5_000;
const checkpointIntervalMs = 5_000;
const gpsStaleMs = 15_000;
const recoveryWindowMs = 30_000;

async function checkLocationServices() {
  if (await Location.hasServicesEnabledAsync()) return true;

  const title = 'Ubicación desactivada';
  const message = 'Activa la ubicación para sincronizar el recorrido.';
  if (Platform.OS === 'web') {
    globalThis.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message, [{ text: 'Entendido' }]);
  }
  return false;
}

async function getRecordingPermission(): Promise<{ mode: RecordingMode; approximate: boolean }> {
  let approximate = false;
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { mode: 'timer', approximate };
    approximate = permission.android?.accuracy === 'coarse' || permission.ios?.accuracy === 'reduced';
  } catch {
    return { mode: 'timer', approximate };
  }

  try {
    if (await backgroundLocationAvailable()) {
      // A user-started Android service records under the foreground location grant.
      if (Platform.OS === 'android') return { mode: 'background', approximate };
      const permission = await Location.getBackgroundPermissionsAsync();
      if (permission.granted || (permission.canAskAgain &&
        (await Location.requestBackgroundPermissionsAsync()).granted)) {
        return { mode: 'background', approximate };
      }
    }
  } catch {
    // The foreground watcher can still record when background access is unavailable.
  }
  return { mode: 'foreground', approximate };
}

export function useActivityTracking() {
  const [draft, setDraft] = useState<RideDraft | null>(null);
  const [now, setNow] = useState(Date.now);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationFailed, setLocationFailed] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const changing = useRef(false);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const stored = await loadRideDraft();
        if (!active) return;
        const finished = stored &&
          (await loadActivities()).some(activity => activity.startedAt === stored.startedAt);
        if (!active) return;
        let restored = stored;
        if (finished) {
          await clearRideDraft();
          restored = null;
        }
        try {
          if (restored?.segmentStart != null) {
            const registered = restored.mode === 'background' && await isBackgroundLocationRegistered();
            // The task may have saved more fixes while the app was opening.
            if (registered) restored = await loadRideDraft();
            const receivingFixes = registered && restored?.lastFixAt != null &&
              Date.now() - restored.lastFixAt <= recoveryWindowMs;
            if (!receivingFixes) {
              restored = await pauseRideDraft();
              await stopBackgroundLocation();
            }
          } else {
            await stopBackgroundLocation();
          }
        } catch {
          restored = await pauseRideDraft();
          if (active) setError('No pudimos detener el servicio de ubicación. Intenta reanudar o guardar la rodada.');
        }
        if (active) {
          setDraft(restored);
          setRecovered(restored !== null && restored.segmentStart === null);
          setReady(true);
        }
      } catch {
        if (active) setError('No pudimos abrir la rodada pendiente.');
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, [attempt]);

  const runCommand = useCallback(async (operation: () => Promise<void>) => {
    if (changing.current) return false;
    changing.current = true;
    revision.current += 1;
    setBusy(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch {
      setError('No pudimos actualizar la rodada. Intenta de nuevo.');
      return false;
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }, []);

  function begin(guidePostId?: string) {
    if (!ready || draft?.segmentStart != null || (guidePostId && draft)) return;
    return runCommand(async () => {
      if (!(await checkLocationServices())) return;
      const permission = await getRecordingPermission();
      const { mode } = permission;
      // The permission flow can take the user to system settings.
      if (!(await checkLocationServices())) return;
      await stopBackgroundLocation();
      const startTime = Date.now();
      let started = await beginRideSegment(mode, startTime, guidePostId);
      setLocationFailed(false);
      setApproximate(permission.approximate);
      setRecovered(false);
      if (mode === 'background') {
        try {
          await startBackgroundLocation();
        } catch {
          started = await setSegmentToForeground(startTime) ?? started;
          try {
            await stopBackgroundLocation();
          } catch {
            setError('No pudimos detener el servicio de ubicación en segundo plano.');
          }
        }
      }
      setNow(Date.now());
      setDraft(started.mode !== 'background' && AppState.currentState === 'background'
        ? await pauseRideDraft(Date.now())
        : started);
    });
  }

  const pause = useCallback(() => runCommand(async () => {
    const paused = await pauseRideDraft(Date.now());
    setDraft(paused);
    await stopBackgroundLocation();
  }), [runCommand]);

  const segmentStart = draft?.segmentStart ?? null;
  const mode = draft?.mode;
  useEffect(() => {
    if (segmentStart === null) return;
    const startedAt = segmentStart;
    let active = true;
    let refreshing = false;
    let lastCheckpoint = Date.now();
    async function refresh() {
      if (changing.current || refreshing) return;
      refreshing = true;
      const version = revision.current;
      try {
        const time = Date.now();
        if (AppState.currentState === 'active' && time - lastCheckpoint >= checkpointIntervalMs) {
          await checkpointRide(startedAt, time);
          lastCheckpoint = time;
        }
        const stored = await loadRideDraft();
        if (active && version === revision.current) setDraft(stored);
      } catch {
        if (active) setError('No pudimos guardar un punto de recuperación.');
      } finally {
        refreshing = false;
      }
    }

    const clock = setInterval(() => setNow(Date.now()), 250);
    const sync = setInterval(() => void refresh(), 1_000);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background' && mode !== 'background') void pause();
      if (state === 'active') {
        setNow(Date.now());
        void refresh();
      }
    });
    return () => {
      active = false;
      clearInterval(clock);
      clearInterval(sync);
      listener.remove();
    };
  }, [mode, pause, segmentStart]);

  useEffect(() => {
    if (segmentStart === null || mode !== 'foreground') return;
    let active = true;
    let subscription: Location.LocationSubscription | undefined;
    function handleError() {
      if (active) setLocationFailed(true);
    }
    Location.watchPositionAsync(rideLocationOptions, position => {
      if (active) {
        setLocationFailed(false);
        void appendRideLocations([position], segmentStart).catch(() => {
          if (active) setError('No pudimos guardar un punto GPS.');
        });
      }
    }, handleError).then(result => {
      if (active) subscription = result;
      else result.remove();
    }).catch(handleError);
    return () => {
      active = false;
      subscription?.remove();
    };
  }, [mode, segmentStart]);

  async function reset() {
    await stopBackgroundLocation();
    await clearRideDraft();
    setDraft(null);
    setRecovered(false);
    setError(null);
  }

  const running = segmentStart !== null;
  const autoPaused = running && draft?.activeSince === null;
  let locationMessage = recovered ? 'Recuperamos tu rodada. Puedes reanudarla o guardarla.' : null;
  if (running && draft) {
    if (mode === 'timer') {
      locationMessage = 'Ubicación no disponible. Solo se registrará el tiempo con la app abierta.';
    } else if (autoPaused) {
      locationMessage = 'La rodada se reanudará cuando vuelvas a moverte.';
    } else if (locationFailed) {
      locationMessage = 'Se perdió la ubicación. El cronómetro sigue activo.';
    } else if (mode === 'foreground') {
      locationMessage = 'Mantén la app abierta. El permiso para registrar con la pantalla bloqueada no está disponible.';
    } else if (approximate) {
      locationMessage = 'La ubicación es aproximada. Activa la ubicación precisa para registrar el recorrido.';
    } else if (draft.lastFixAt === null) {
      locationMessage = 'Buscando señal GPS…';
    } else if (now - draft.lastFixAt > gpsStaleMs) {
      locationMessage = 'Señal GPS débil. Esperando una ubicación más precisa.';
    }
  }

  return {
    activity: draft && {
      startedAt: draft.startedAt,
      durationMs: draft.durationMs,
      distanceM: draft.distanceM,
      elevationGainM: draft.elevationGainM,
    },
    running,
    autoPaused,
    segment: draft?.segment ?? 0,
    guidePostId: draft?.guidePostId ?? null,
    lastFixAt: draft?.lastFixAt ?? null,
    elapsedMs: draft ? rideElapsedMs(draft, now) : 0,
    currentSpeedKmh: running && !autoPaused && !locationFailed && draft?.lastFixAt != null && now - draft.lastFixAt < speedMaxAgeMs
      ? draft.speedKmh
      : null,
    ready,
    busy,
    error,
    locationMessage,
    retryRestore: () => {
      setError(null);
      setAttempt(current => current + 1);
    },
    getRoute: loadDraftRoute,
    start: begin,
    pause,
    resume: () => begin(),
    reset,
  };
}
