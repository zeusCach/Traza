const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/database/rideDraft.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const routeDistanceSource = readFileSync(join(__dirname, '../src/features/activities/routeDistance.ts'), 'utf8');
const routeDistance = {};
runInNewContext(ts.transpileModule(routeDistanceSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: routeDistance });

function testDatabase(t) {
  const databases = new Map();
  function openDatabase(name) {
    if (databases.has(name)) return databases.get(name);
    const database = new DatabaseSync(':memory:');
    t.after(() => database.close());
    const adapter = {
      execAsync: async sql => database.exec(sql),
      runAsync: async (sql, ...params) => database.prepare(sql).run(...params),
      getFirstAsync: async (sql, ...params) => database.prepare(sql).get(...params) ?? null,
      getAllAsync: async (sql, ...params) => database.prepare(sql).all(...params),
      withTransactionAsync(operation) {
        return adapter.withExclusiveTransactionAsync(operation);
      },
      async withExclusiveTransactionAsync(operation) {
        database.exec('BEGIN IMMEDIATE');
        try {
          await operation(adapter);
          database.exec('COMMIT');
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
      },
    };
    databases.set(name, adapter);
    return adapter;
  }
  return () => {
    const exports = {};
    runInNewContext(outputText, {
      exports,
      setTimeout,
      require(module) {
        if (module === '@/features/activities/routeDistance') return routeDistance;
        assert.equal(module, 'expo-sqlite');
        return { openDatabaseAsync: async name => openDatabase(name) };
      },
    });
    return exports;
  };
}

function location(timestamp, latitude, accuracy = 5, speed = 6) {
  return { timestamp, coords: { latitude, longitude: -86, accuracy, speed } };
}

test('keeps drafts and background points separate by account', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.beginRideSegment('beto', 'background', 1_000);
  await store.appendRideLocations('ana', [location(1_100, 21)], 'background');
  assert.equal((await store.loadDraftRoute('ana')).length, 1);
  assert.equal((await store.loadDraftRoute('beto')).length, 0);
  await store.clearRideDraft('beto');
  assert.equal(await store.loadRideDraft('beto'), null);
  assert.equal((await store.loadRideDraft('ana')).startedAt, 1_000);
});

test('preserves paused time and separates resumed background segments', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.appendRideLocations('ana', [location(2_000, 21.00005), location(1_000, 21)], 'background');
  await store.appendRideLocations('ana', [location(2_000, 21.5), location(2_100, 21.5, 50)], 'background');
  await store.pauseRideDraft('ana', 3_000);
  await store.appendRideLocations('ana', [location(3_500, 21.5)], 'background');

  const firstDistance = (await store.loadRideDraft('ana')).distanceM;
  await store.beginRideSegment('ana', 'background', 10_000);
  await store.appendRideLocations('ana', [location(9_000, 21.5), location(10_000, 21.1)], 'background');
  assert.equal((await store.loadRideDraft('ana')).distanceM, firstDistance);
  await store.appendRideLocations('ana', [location(11_000, 21.10005)], 'background');
  await store.pauseRideDraft('ana', 12_000);

  const draft = await store.loadRideDraft('ana');
  assert.equal(draft.durationMs, 4_000);
  assert.ok(Math.abs(draft.distanceM - 2 * firstDistance) < 0.01);
  const route = await store.loadDraftRoute('ana');
  assert.equal(JSON.stringify(route.map(segment => segment.map(point => point.timestamp))),
    '[[1000,2000],[10000,11000]]');
});

test('recovers the last durable checkpoint after reopening an interrupted ride', async t => {
  const openStore = testDatabase(t);
  const store = openStore();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.appendRideLocations('ana', [location(2_000, 21), location(3_000, 21.00005)], 'background');

  const reopened = openStore();
  const recovered = await reopened.pauseRideDraft('ana', );
  assert.equal(recovered.segmentStart, null);
  assert.equal(recovered.durationMs, 2_000);
  assert.equal((await reopened.loadDraftRoute('ana'))[0].length, 2);

  await reopened.clearRideDraft('ana');
  assert.equal(await reopened.loadRideDraft('ana'), null);
  assert.equal((await reopened.loadDraftRoute('ana')).length, 0);
});

test('records in foreground after fallback and checkpoints a timer-only ride', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.setSegmentToForeground('ana', 1_000);
  await store.appendRideLocations('ana', [location(2_000, 21.5)], 'background');
  await store.appendRideLocations('ana', [location(2_000, 21.5)], 999);
  await store.appendRideLocations('ana', [location(2_000, 21)], 1_000);
  assert.equal((await store.loadDraftRoute('ana'))[0].length, 1);

  await store.clearRideDraft('ana');
  await store.beginRideSegment('ana', 'timer', 3_000);
  await store.checkpointRide('ana', 3_000, 8_000);
  assert.equal((await store.pauseRideDraft('ana', )).durationMs, 5_000);
  assert.equal((await store.loadDraftRoute('ana')).length, 0);
});

test('loads only new map points from the selected draft and preserves segment boundaries', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.appendRideLocations('ana', [location(1_000, 21), location(2_000, 21.00005)], 'background');
  const first = await store.loadDraftRoutePoints('ana', 1_000);
  assert.equal(first.length, 2);
  assert.equal((await store.loadDraftRoutePoints('ana', 1_000, first[1])).length, 0);
  assert.equal((await store.loadDraftRoutePoints('ana', 2_000)).length, 0);
  assert.equal((await store.loadDraftRoutePoints('ana', 1_000, undefined, first[0])).length, 1);

  await store.pauseRideDraft('ana', 3_000);
  await store.beginRideSegment('ana', 'background', 4_000);
  await store.appendRideLocations('ana', [location(4_000, 21.1)], 'background');
  const next = await store.loadDraftRoutePoints('ana', 1_000, first[1]);
  assert.equal(next.length, 1);
  assert.equal(next[0].segment, 2);
  assert.equal(next[0].timestamp, 4_000);
});

test('acquires GPS without drawing startup drift and starts drawing when the rider moves', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.appendRideLocations('ana', [
    location(1_000, 21, 40, 0),
    location(2_000, 21, 10, 0),
    location(3_000, 21.0001, 10, 0.7),
    location(4_000, 21.0008, 8, 1),
    location(5_000, 21.00081, 5, null),
  ], 'background');

  const stationary = await store.loadRideDraft('ana');
  assert.equal(stationary.lastFixAt, 5_000);
  assert.equal(stationary.distanceM, 0);
  assert.ok((await store.loadDraftRoute('ana')).every(segment => segment.length === 1));

  await store.appendRideLocations('ana', [location(6_000, 21.00085, 5, 3)], 'background');
  const moving = await store.loadRideDraft('ana');
  assert.ok(moving.distanceM > 5 && moving.distanceM < 6);
  assert.equal((await store.loadDraftRoute('ana')).at(-1).length, 2);
});

test('records short movements and filters nearby fixes when stopped', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'foreground', 1_000);
  await store.appendRideLocations('ana', [
    location(1_000, 21),
    location(2_000, 21.00002, 5, 2),
    location(3_000, 21.00004, 5, 2),
    location(4_000, 21.00006, 5, 0),
  ], 1_000);

  const [route] = await store.loadDraftRoute('ana');
  const draft = await store.loadRideDraft('ana');
  assert.equal(JSON.stringify(route.map(point => point.timestamp)), '[1000,2000,3000]');
  assert.ok(draft.distanceM > 4 && draft.distanceM < 5);
  assert.equal(draft.speedKmh, 0);
});

test('automatically pauses from the first stationary fix and resumes in a new route segment', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.appendRideLocations('ana', [
    location(1_000, 21),
    location(2_000, 21.00005),
    ...Array.from({ length: 9 }, (_, index) => location(3_000 + index * 1_000, 21.00006, 5, 0)),
  ], 'background');

  const paused = await store.loadRideDraft('ana');
  assert.equal(paused.segmentStart, 1_000);
  assert.equal(paused.activeSince, null);
  assert.equal(store.rideElapsedMs(paused, 15_000), 2_000);
  assert.equal((await store.loadDraftRoute('ana'))[0].length, 2);
  await store.checkpointRide('ana', 1_000, 15_000);

  await store.appendRideLocations('ana', [location(16_000, 21.00006), location(17_000, 21.00011)], 'background');
  const resumed = await store.loadRideDraft('ana');
  assert.equal(resumed.activeSince, 16_000);
  assert.equal(store.rideElapsedMs(resumed, 18_000), 4_000);
  assert.ok(Math.abs(resumed.distanceM - 2 * paused.distanceM) < 0.01);
  assert.equal(JSON.stringify((await store.loadDraftRoute('ana')).map(segment => segment.map(point => point.timestamp))),
    '[[1000,2000],[16000,17000]]');
  assert.equal((await store.pauseRideDraft('ana', 18_000)).durationMs, 4_000);
});

test('does not interpret poor GPS or gaps in fixes as continuous stationary time', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'foreground', 1_000);
  await store.appendRideLocations('ana', [
    location(1_000, 21, 5, 0),
    location(3_000, 21, 50, 0),
    location(8_000, 21, 50, 0),
    location(10_000, 21, 5, 0),
    location(12_000, 21.00004, 5, 2),
    location(16_000, 21.00004, 5, 0),
    location(20_000, 21.00008, 5, 2),
  ], 1_000);
  const active = await store.loadRideDraft('ana');
  assert.equal(active.activeSince, 1_000);
  assert.equal(store.rideElapsedMs(active, 20_000), 19_000);
});

test('manual pause during an automatic pause prevents motion from resuming the ride', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('ana', 'foreground', 1_000);
  await store.appendRideLocations('ana', [
    location(1_000, 21),
    ...Array.from({ length: 9 }, (_, index) => location(2_000 + index * 1_000, 21, 5, 0)),
  ], 1_000);
  const paused = await store.pauseRideDraft('ana', 15_000);
  assert.equal(paused.segmentStart, null);
  assert.equal(paused.durationMs, 1_000);
  await store.appendRideLocations('ana', [location(16_000, 21.001)], 1_000);
  assert.equal((await store.loadRideDraft('ana')).segmentStart, null);
});

test('background fixes continue after reopening and a long GPS gap does not add a straight line', async t => {
  const openStore = testDatabase(t);
  const store = openStore();
  await store.beginRideSegment('ana', 'background', 1_000);
  await store.appendRideLocations('ana', [location(1_000, 21), location(2_000, 21.00005)], 'background');
  const reopened = openStore();
  await reopened.appendRideLocations('ana', [location(3_000, 21.0001), location(4_000, 21.00015, -1)], 'background');
  const distanceBeforeGap = (await reopened.loadRideDraft('ana')).distanceM;
  await reopened.appendRideLocations('ana', [location(45_000, 21.01), location(46_000, 21.01005)], 'background');
  const route = await reopened.loadDraftRoute('ana');
  assert.equal(JSON.stringify(route.map(segment => segment.map(point => point.timestamp))),
    '[[1000,2000,3000],[45000,46000]]');
  assert.ok(Math.abs((await reopened.loadRideDraft('ana')).distanceM - distanceBeforeGap * 1.5) < 0.1);
});
