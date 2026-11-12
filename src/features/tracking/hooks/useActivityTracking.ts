import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { loadActivities } from '@/database/activities';
import {
  appendRideLocations,
  beginRideSegment,
  checkpointRide,
  clearRideDraft,
  loadDraftRoute,
  loadRideDraft,
  pauseRideDraft,
  setSegmentToForeground,
  type RecordingMode,
  type RideDraft,
} from '@/database/rideDraft';

import {
  backgroundLocationAvailable,
  rideLocationOptions,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '../backgroundLocation';

const speedMaxAgeMs = 5_000;
const checkpointIntervalMs = 5_000;

async function recordingMode(): Promise<RecordingMode> {
  try {
    if (!(await Location.requestForegroundPermissionsAsync()).granted) return 'timer';
  } catch {
    return 'timer';
  }

  try {
    if (await backgroundLocationAvailable()) {
      const permission = await Location.getBackgroundPermissionsAsync();
      if (permission.granted || (permission.canAskAgain &&
        (await Location.requestBackgroundPermissionsAsync()).granted)) {
        return 'background';
      }
    }
  } catch {
    // The foreground watcher can still record when background access is unavailable.
  }
  return 'foreground';
}

export function useActivityTracking() {
  const [draft, setDraft] = useState<RideDraft | null>(null);
  const [now, setNow] = useState(Date.now);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationFailed, setLocationFailed] = useState(false);
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
        } else if (stored?.segmentStart != null) {
          restored = await pauseRideDraft();
        }
        try {
          await stopBackgroundLocation();
        } catch {
          if (active) setError('No pudimos detener el servicio de ubicación. Intenta reanudar o guardar la rodada.');
        }
        if (active) {
          setDraft(restored);
          setRecovered(restored !== null);
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
    if (changing.current) return;
    changing.current = true;
    revision.current += 1;
    setBusy(true);
    setError(null);
    try {
      await operation();
    } catch {
      setError('No pudimos actualizar la rodada. Intenta de nuevo.');
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }, []);

  function begin() {
    if (!ready || draft?.segmentStart != null) return;
    return runCommand(async () => {
      const mode = await recordingMode();
      await stopBackgroundLocation();
      const startTime = Date.now();
      let started = await beginRideSegment(mode, startTime);
      setLocationFailed(false);
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
  let locationMessage = recovered ? 'Recuperamos tu rodada. Puedes reanudarla o guardarla.' : null;
  if (running && draft) {
    if (mode === 'timer') {
      locationMessage = 'Ubicación no disponible. Solo se registrará el tiempo con la app abierta.';
    } else if (locationFailed) {
      locationMessage = 'Se perdió la ubicación. El cronómetro sigue activo.';
    } else if (mode === 'foreground') {
      locationMessage = 'Mantén la app abierta. El permiso para registrar con la pantalla bloqueada no está disponible.';
    } else if (draft.lastFixAt === null) {
      locationMessage = 'Buscando señal GPS…';
    }
  }

  return {
    activity: draft && { startedAt: draft.startedAt, durationMs: draft.durationMs, distanceM: draft.distanceM },
    running,
    elapsedMs: (draft?.durationMs ?? 0) + (segmentStart === null ? 0 : Math.max(0, now - segmentStart)),
    currentSpeedKmh: running && !locationFailed && draft?.lastFixAt != null && now - draft.lastFixAt < speedMaxAgeMs
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
    resume: begin,
    reset,
  };
}
