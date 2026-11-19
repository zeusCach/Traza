import type { LocationObject } from 'expo-location';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { distanceBetween } from '@/features/activities/routeDistance';

import type { Activity, ActivityRoute, RoutePoint } from './activities';

export type RecordingMode = 'background' | 'foreground' | 'timer';

type MotionFix = RoutePoint & { accuracy: number; speedMps: number | null };

interface GpsState {
  position: RoutePoint | null;
  pending: MotionFix[];
  moving: boolean;
}

export interface RideDraft extends Activity {
  mode: RecordingMode;
  segment: number;
  segmentStart: number | null;
  activeSince: number | null;
  stationarySince: number | null;
  checkpointAt: number;
  lastFixAt: number | null;
  speedKmh: number | null;
  maxSpeedKmh: number | null;
  elevationGainM: number | null;
  lastAltitudeM: number | null;
  guidePostId: string | null;
  gpsState: GpsState | null;
}

const databases = new Map<string, Promise<SQLiteDatabase>>();
let pendingWrite = Promise.resolve();
const stationaryDelayMs = 8_000;
const maxFixGapMs = 5_000;
const maxRouteGapMs = 30_000;
const maxHorizontalAccuracyM = 25;
const maxMapAccuracyM = 100;
const minMovingSpeedMps = 0.45;
const slowMotionSpeedMps = 1.4;
const minCandidateIntervalMs = 500;
const motionWindowMs = 20_000;

async function retryLocked<T>(operation: () => Promise<T>): Promise<T> {
  for (const delay of [50, 150, 400]) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Error) || !/SQLITE_(BUSY|LOCKED)|database (?:table |schema )?is locked/i.test(error.message)) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return operation();
}

function openDraftDatabase(accountId: string) {
  const existing = databases.get(accountId);
  if (existing) return existing;
  const database = openDatabaseAsync(`traza-ride-draft.${accountId}.db`).then(async db => {
    await retryLocked(() => db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS draft (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        startedAt INTEGER NOT NULL,
        durationMs INTEGER NOT NULL,
        distanceM REAL,
        mode TEXT NOT NULL,
        segment INTEGER NOT NULL,
        segmentStart INTEGER,
        checkpointAt INTEGER NOT NULL,
        lastFixAt INTEGER,
        speedKmh REAL
      );
      CREATE TABLE IF NOT EXISTS points (
        segment INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        PRIMARY KEY (segment, timestamp)
      );
    `));
    await retryLocked(() => db.withTransactionAsync(async () => {
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const schemaVersion = version?.user_version ?? 0;
      if (schemaVersion < 1) {
        await db.execAsync(`
          ALTER TABLE draft ADD COLUMN elevationGainM REAL;
          ALTER TABLE draft ADD COLUMN lastAltitudeM REAL;
        `);
      }
      if (schemaVersion < 2) {
        await db.execAsync('ALTER TABLE points ADD COLUMN altitudeM REAL;');
      }
      if (schemaVersion < 3) {
        await db.execAsync(`
          ALTER TABLE draft ADD COLUMN activeSince INTEGER;
          ALTER TABLE draft ADD COLUMN stationarySince INTEGER;
          UPDATE draft SET activeSince = segmentStart;
          PRAGMA user_version = 3;
        `);
      }
      if (schemaVersion < 4) {
        await db.execAsync('ALTER TABLE draft ADD COLUMN guidePostId TEXT; PRAGMA user_version = 4;');
      }
      if (schemaVersion < 5) {
        await db.execAsync('ALTER TABLE draft ADD COLUMN maxSpeedKmh REAL; PRAGMA user_version = 5;');
      }
      if (schemaVersion < 6) {
        await db.execAsync('ALTER TABLE draft ADD COLUMN gpsState TEXT; PRAGMA user_version = 6;');
      }
    }));
    return db;
  }).catch(error => {
    databases.delete(accountId);
    throw error;
  });
  databases.set(accountId, database);
  return database;
}

function write<T>(accountId: string, operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = pendingWrite.then(async () => {
    const db = await openDraftDatabase(accountId);
    const response: { value?: T } = {};
    await retryLocked(() => db.withExclusiveTransactionAsync(async transaction => {
      response.value = await operation(transaction);
    }));
    return response.value as T;
  });
  pendingWrite = result.then(() => undefined, () => undefined);
  return result;
}

async function readDraft(db: SQLiteDatabase): Promise<RideDraft | null> {
  const row = await db.getFirstAsync<Omit<RideDraft, 'gpsState'> & { gpsState: string | null }>('SELECT * FROM draft WHERE id = 1');
  return row && { ...row, gpsState: row.gpsState ? JSON.parse(row.gpsState) : null };
}

export async function loadRideDraft(accountId: string) {
  return readDraft(await openDraftDatabase(accountId));
}

export function beginRideSegment(accountId: string, mode: RecordingMode, now: number, guidePostId?: string) {
  return write(accountId, async db => {
    const draft = await readDraft(db);
    if (guidePostId && draft) throw new Error('Ya hay una rodada pendiente');
    if (draft?.segmentStart != null) return draft;
    await db.runAsync(`
      INSERT INTO draft (id, startedAt, durationMs, mode, segment, segmentStart, activeSince, checkpointAt, guidePostId)
      VALUES (1, ?, 0, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode, segment = draft.segment + 1,
        segmentStart = excluded.segmentStart, activeSince = excluded.activeSince, checkpointAt = excluded.checkpointAt,
        stationarySince = NULL, gpsState = NULL,
        lastFixAt = NULL, speedKmh = NULL, lastAltitudeM = NULL
    `, now, mode, now, now, now, guidePostId ?? null);
    return (await readDraft(db))!;
  });
}

export function setSegmentToForeground(accountId: string, segmentStart: number) {
  return write(accountId, async db => {
    await db.runAsync(
      "UPDATE draft SET mode = 'foreground' WHERE id = 1 AND segmentStart = ?",
      segmentStart,
    );
    return readDraft(db);
  });
}

export function pauseRideDraft(accountId: string, stoppedAt?: number) {
  return write(accountId, async db => {
    await db.runAsync(`
      UPDATE draft SET durationMs = durationMs + COALESCE(MAX(0, COALESCE(?, checkpointAt) - activeSince), 0),
        segmentStart = NULL, activeSince = NULL, stationarySince = NULL, lastFixAt = NULL, speedKmh = NULL
      WHERE id = 1 AND segmentStart IS NOT NULL
    `, stoppedAt ?? null);
    return readDraft(db);
  });
}

export function rideElapsedMs(draft: RideDraft, now: number) {
  return draft.durationMs + (draft.activeSince === null ? 0 : Math.max(0, now - draft.activeSince));
}

export function checkpointRide(accountId: string, segmentStart: number, now: number) {
  return write(accountId, async db => {
    await db.runAsync(
      'UPDATE draft SET checkpointAt = MAX(checkpointAt, ?) WHERE id = 1 AND segmentStart = ?',
      now, segmentStart,
    );
  });
}

export function clearRideDraft(accountId: string) {
  return write(accountId, db => db.execAsync('DELETE FROM points; DELETE FROM draft;'));
}

export type DraftRoutePoint = RoutePoint & { segment: number };

export async function loadDraftRoutePoints(
  accountId: string,
  startedAt: number,
  after?: Pick<DraftRoutePoint, 'segment' | 'timestamp'>,
  through?: Pick<DraftRoutePoint, 'segment' | 'timestamp'>,
) {
  const db = await openDraftDatabase(accountId);
  return db.getAllAsync<DraftRoutePoint>(`
    SELECT segment, timestamp, latitude, longitude, altitudeM FROM points
    WHERE (segment, timestamp) > (?, ?)
      AND (segment, timestamp) <= (?, ?)
      AND EXISTS (SELECT 1 FROM draft WHERE startedAt = ?)
    ORDER BY segment, timestamp
  `, after?.segment ?? 0, after?.timestamp ?? 0,
  through?.segment ?? Number.MAX_SAFE_INTEGER, through?.timestamp ?? 0, startedAt);
}

export async function loadDraftRoute(accountId: string): Promise<ActivityRoute> {
  const db = await openDraftDatabase(accountId);
  const rows = await db.getAllAsync<RoutePoint & { segment: number }>(
    'SELECT segment, timestamp, latitude, longitude, altitudeM FROM points ORDER BY segment, timestamp',
  );
  const route: ActivityRoute = [];
  let segmentNumber = -1;
  for (const { segment, ...point } of rows) {
    if (segment !== segmentNumber) {
      route.push([]);
      segmentNumber = segment;
    }
    route[route.length - 1].push(point);
  }
  return route;
}

function plausibleStep(from: RoutePoint, to: MotionFix) {
  const elapsed = (to.timestamp - from.timestamp) / 1_000;
  const accuracyAllowance = Math.max(4, to.accuracy * 0.75);
  const speedAllowance = (to.speedMps ?? 18) * elapsed * 1.8;
  return distanceBetween(from, to) <= accuracyAllowance + speedAllowance;
}

function confirmMotion(fixes: MotionFix[]) {
  if (fixes.length < 3) return false;
  const first = fixes[0];
  const last = fixes[fixes.length - 1];
  const elapsed = (last.timestamp - first.timestamp) / 1_000;
  const displacement = distanceBetween(first, last);
  const observedSpeed = displacement / elapsed;
  const slow = observedSpeed < slowMotionSpeedMps || fixes.some(fix => fix.speedMps !== null && fix.speedMps < slowMotionSpeedMps);
  const uncertainty = Math.max(...fixes.map(fix => fix.accuracy));
  const minimumDisplacement = slow ? Math.max(4, uncertainty) : Math.max(6, uncertainty * 1.25);
  if (elapsed < (slow ? 4 : 2) || displacement < minimumDisplacement || observedSpeed < minMovingSpeedMps) return false;
  if (slow) {
    const reported = fixes.flatMap(fix => fix.speedMps === null ? [] : [fix.speedMps]);
    const averageReported = reported.reduce((sum, speed) => sum + speed, 0) / reported.length;
    if (reported.length && observedSpeed > averageReported * 1.75 + 0.2) return false;
  }
  const pathLength = fixes.slice(1).reduce((sum, fix, index) => sum + distanceBetween(fixes[index], fix), 0);
  return displacement >= pathLength * 0.8;
}

export function appendRideLocations(accountId: string, locations: LocationObject[], source: 'background' | number) {
  return write(accountId, async db => {
    const draft = await readDraft(db);
    if (!draft || draft.segmentStart === null ||
      (source === 'background' ? draft.mode !== source : draft.mode !== 'foreground' || draft.segmentStart !== source)) {
      return;
    }
    let previous = await db.getFirstAsync<RoutePoint>(
      'SELECT timestamp, latitude, longitude FROM points WHERE segment = ? ORDER BY timestamp DESC LIMIT 1',
      draft.segment,
    );
    const gps = draft.gpsState ?? { position: null, pending: [], moving: false };
    const ordered = [...locations].sort((a, b) => a.timestamp - b.timestamp);
    for (const { coords, timestamp } of ordered) {
      if (!Number.isFinite(timestamp) || timestamp < draft.segmentStart) continue;
      draft.checkpointAt = Math.max(draft.checkpointAt, timestamp);
      if (timestamp <= (draft.lastFixAt ?? -Infinity) ||
        coords.accuracy === null || !Number.isFinite(coords.accuracy) ||
        coords.accuracy <= 0 || coords.accuracy > maxMapAccuracyM ||
        !(Math.abs(coords.latitude) <= 90) || !(Math.abs(coords.longitude) <= 180)) {
        continue;
      }
      const altitude = coords.altitude;
      const altitudeM = altitude !== null && Number.isFinite(altitude) ? altitude : null;
      const point = { latitude: coords.latitude, longitude: coords.longitude, timestamp, altitudeM };
      if (!gps.position || timestamp > gps.position.timestamp) gps.position = point;
      if (coords.accuracy > maxHorizontalAccuracyM) continue;

      const fixGap = timestamp - (draft.lastFixAt ?? timestamp);
      draft.lastFixAt = timestamp;
      if (fixGap > maxFixGapMs || (gps.moving && previous && timestamp - previous.timestamp > maxRouteGapMs)) {
        gps.pending = [];
        gps.moving = false;
      }
      const speed = coords.speed;
      const speedMps = speed !== null && Number.isFinite(speed) && speed >= 0 ? speed : null;
      const fix = { ...point, speedMps, accuracy: coords.accuracy };
      const stationary = speedMps !== null && speedMps < minMovingSpeedMps;
      let confirmed: MotionFix[] = [];
      if (stationary) {
        gps.moving = false;
        gps.pending = [];
      } else if (gps.moving && previous && plausibleStep(previous, fix)) {
        confirmed = [fix];
      } else {
        gps.moving = false;
        const lastCandidate = gps.pending.at(-1);
        if (lastCandidate && !plausibleStep(lastCandidate, fix)) gps.pending = [];
        gps.pending = gps.pending.filter(candidate => timestamp - candidate.timestamp <= motionWindowMs);
        const previousCandidate = gps.pending.at(-1);
        if (!previousCandidate || timestamp - previousCandidate.timestamp >= minCandidateIntervalMs) gps.pending.push(fix);
        const start = gps.pending.findIndex((_, index) => confirmMotion(gps.pending.slice(index)));
        if (start !== -1) {
          confirmed = gps.pending.slice(start);
          gps.pending = [];
          gps.moving = true;
          if (previous) draft.segment += 1;
          draft.lastAltitudeM = null;
          previous = null;
        }
      }
      if (!confirmed.length) {
        draft.speedKmh = 0;
        draft.distanceM ??= 0;
        if (!stationary) {
          draft.stationarySince = null;
        } else if (draft.activeSince !== null) {
          if (draft.stationarySince === null || fixGap > maxFixGapMs) draft.stationarySince = timestamp;
          if (timestamp - draft.stationarySince >= stationaryDelayMs) {
            draft.durationMs += Math.max(0, draft.stationarySince - draft.activeSince);
            draft.activeSince = null;
            draft.stationarySince = null;
          }
        }
        continue;
      }
      draft.stationarySince = null;
      draft.activeSince ??= confirmed[0].timestamp;
      draft.speedKmh = speedMps !== null ? speedMps * 3.6 : draft.speedKmh ?? 0;
      for (const accepted of confirmed) {
        const distance = previous ? distanceBetween(previous, accepted) : 0;
        if (previous && distance < 1) continue;
        if (previous) {
          const elapsed = (accepted.timestamp - previous.timestamp) / 1_000;
          const acceptedSpeed = (accepted.speedMps ?? distance / elapsed) * 3.6;
          draft.speedKmh = acceptedSpeed;
          draft.maxSpeedKmh = Math.max(draft.maxSpeedKmh ?? 0, acceptedSpeed);
        }
        await db.runAsync(
          'INSERT INTO points (segment, timestamp, latitude, longitude, altitudeM) VALUES (?, ?, ?, ?, ?)',
          draft.segment, accepted.timestamp, accepted.latitude, accepted.longitude, accepted.altitudeM ?? null,
        );
        previous = accepted;
        draft.distanceM = (draft.distanceM ?? 0) + distance;
        if (accepted.altitudeM != null && draft.lastAltitudeM !== null) {
          draft.elevationGainM = (draft.elevationGainM ?? 0) + Math.max(0, accepted.altitudeM - draft.lastAltitudeM);
        }
        draft.lastAltitudeM = accepted.altitudeM ?? null;
      }
    }
    await db.runAsync(`
      UPDATE draft SET checkpointAt = ?, lastFixAt = ?, speedKmh = ?, distanceM = ?,
        elevationGainM = ?, lastAltitudeM = ?, durationMs = ?, segment = ?, activeSince = ?, stationarySince = ?,
        maxSpeedKmh = ?, gpsState = ?
      WHERE id = 1
    `, draft.checkpointAt, draft.lastFixAt, draft.speedKmh, draft.distanceM,
    draft.elevationGainM, draft.lastAltitudeM, draft.durationMs, draft.segment, draft.activeSince, draft.stationarySince,
    draft.maxSpeedKmh, JSON.stringify(gps));
  });
}
