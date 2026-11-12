import type { LocationObject } from 'expo-location';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { distanceBetween } from '@/features/activities/routeDistance';

import type { Activity, ActivityRoute, RoutePoint } from './activities';

export type RecordingMode = 'background' | 'foreground' | 'timer';

export interface RideDraft extends Activity {
  mode: RecordingMode;
  segment: number;
  segmentStart: number | null;
  checkpointAt: number;
  lastFixAt: number | null;
  speedKmh: number | null;
  elevationGainM: number | null;
  lastAltitudeM: number | null;
}

let database: Promise<SQLiteDatabase> | undefined;
let pendingWrite = Promise.resolve();

function openDraftDatabase() {
  database ??= openDatabaseAsync('traza-ride-draft.db').then(async db => {
    await db.execAsync(`
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
    `);
    await db.withTransactionAsync(async () => {
      const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const schemaVersion = version?.user_version ?? 0;
      if (schemaVersion < 1) {
        await db.execAsync(`
          ALTER TABLE draft ADD COLUMN elevationGainM REAL;
          ALTER TABLE draft ADD COLUMN lastAltitudeM REAL;
        `);
      }
      if (schemaVersion < 2) {
        await db.execAsync('ALTER TABLE points ADD COLUMN altitudeM REAL; PRAGMA user_version = 2;');
      }
    });
    return db;
  }).catch(error => {
    database = undefined;
    throw error;
  });
  return database;
}

function write<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const result = pendingWrite.then(async () => {
    const db = await openDraftDatabase();
    const response: { value?: T } = {};
    await db.withExclusiveTransactionAsync(async transaction => {
      response.value = await operation(transaction);
    });
    return response.value as T;
  });
  pendingWrite = result.then(() => undefined, () => undefined);
  return result;
}

function readDraft(db: SQLiteDatabase) {
  return db.getFirstAsync<RideDraft>('SELECT * FROM draft WHERE id = 1');
}

export async function loadRideDraft() {
  return readDraft(await openDraftDatabase());
}

export function beginRideSegment(mode: RecordingMode, now: number) {
  return write(async db => {
    const draft = await readDraft(db);
    if (draft?.segmentStart != null) return draft;
    await db.runAsync(`
      INSERT INTO draft (id, startedAt, durationMs, mode, segment, segmentStart, checkpointAt)
      VALUES (1, ?, 0, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        mode = excluded.mode, segment = draft.segment + 1,
        segmentStart = excluded.segmentStart, checkpointAt = excluded.checkpointAt,
        lastFixAt = NULL, speedKmh = NULL, lastAltitudeM = NULL
    `, now, mode, now, now);
    return (await readDraft(db))!;
  });
}

export function setSegmentToForeground(segmentStart: number) {
  return write(async db => {
    await db.runAsync(
      "UPDATE draft SET mode = 'foreground' WHERE id = 1 AND segmentStart = ?",
      segmentStart,
    );
    return readDraft(db);
  });
}

export function pauseRideDraft(stoppedAt?: number) {
  return write(async db => {
    await db.runAsync(`
      UPDATE draft SET durationMs = durationMs + MAX(0, COALESCE(?, checkpointAt) - segmentStart),
        segmentStart = NULL, lastFixAt = NULL, speedKmh = NULL
      WHERE id = 1 AND segmentStart IS NOT NULL
    `, stoppedAt ?? null);
    return readDraft(db);
  });
}

export function checkpointRide(segmentStart: number, now: number) {
  return write(async db => {
    await db.runAsync(
      'UPDATE draft SET checkpointAt = MAX(checkpointAt, ?) WHERE id = 1 AND segmentStart = ?',
      now, segmentStart,
    );
  });
}

export function clearRideDraft() {
  return write(db => db.execAsync('DELETE FROM points; DELETE FROM draft;'));
}

export type DraftRoutePoint = RoutePoint & { segment: number };

export async function loadDraftRoutePoints(
  startedAt: number,
  after?: Pick<DraftRoutePoint, 'segment' | 'timestamp'>,
) {
  const db = await openDraftDatabase();
  return db.getAllAsync<DraftRoutePoint>(`
    SELECT segment, timestamp, latitude, longitude, altitudeM FROM points
    WHERE (segment, timestamp) > (?, ?)
      AND EXISTS (SELECT 1 FROM draft WHERE startedAt = ?)
    ORDER BY segment, timestamp
  `, after?.segment ?? 0, after?.timestamp ?? 0, startedAt);
}

export async function loadDraftRoute(): Promise<ActivityRoute> {
  const db = await openDraftDatabase();
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

export function appendRideLocations(locations: LocationObject[], source: 'background' | number) {
  return write(async db => {
    const draft = await readDraft(db);
    if (!draft || draft.segmentStart === null ||
      (source === 'background' ? draft.mode !== source : draft.mode !== 'foreground' || draft.segmentStart !== source)) {
      return;
    }
    let previous = await db.getFirstAsync<RoutePoint>(
      'SELECT timestamp, latitude, longitude FROM points WHERE segment = ? ORDER BY timestamp DESC LIMIT 1',
      draft.segment,
    );
    const ordered = [...locations].sort((a, b) => a.timestamp - b.timestamp);
    for (const { coords, timestamp } of ordered) {
      if (!Number.isFinite(timestamp) || timestamp < draft.segmentStart) continue;
      draft.checkpointAt = Math.max(draft.checkpointAt, timestamp);
      if (timestamp <= (draft.lastFixAt ?? -Infinity) ||
        coords.accuracy === null || !Number.isFinite(coords.accuracy) || coords.accuracy > 25 ||
        !(Math.abs(coords.latitude) <= 90) || !(Math.abs(coords.longitude) <= 180)) {
        continue;
      }
      draft.lastFixAt = timestamp;
      const speed = coords.speed;
      draft.speedKmh = speed !== null && Number.isFinite(speed) && speed >= 0 ? speed * 3.6 : null;
      const altitude = coords.altitude;
      const altitudeM = altitude !== null && Number.isFinite(altitude) ? altitude : null;
      const point = { latitude: coords.latitude, longitude: coords.longitude, timestamp, altitudeM };
      const distance = previous ? distanceBetween(previous, point) : 0;
      if (previous && distance < 5) continue;
      await db.runAsync(
        'INSERT INTO points (segment, timestamp, latitude, longitude, altitudeM) VALUES (?, ?, ?, ?, ?)',
        draft.segment, timestamp, point.latitude, point.longitude, altitudeM,
      );
      previous = point;
      draft.distanceM = (draft.distanceM ?? 0) + distance;
      if (altitudeM !== null) {
        if (draft.lastAltitudeM !== null) {
          const climb = Math.max(0, altitudeM - draft.lastAltitudeM);
          draft.elevationGainM = (draft.elevationGainM ?? 0) + climb;
        }
        draft.lastAltitudeM = altitudeM;
      } else {
        draft.lastAltitudeM = null;
      }
    }
    await db.runAsync(`
      UPDATE draft SET checkpointAt = ?, lastFixAt = ?, speedKmh = ?, distanceM = ?,
        elevationGainM = ?, lastAltitudeM = ?
      WHERE id = 1
    `, draft.checkpointAt, draft.lastFixAt, draft.speedKmh, draft.distanceM,
    draft.elevationGainM, draft.lastAltitudeM);
  });
}
