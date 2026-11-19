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
  return () => {
    const exports = {};
    runInNewContext(outputText, {
      exports,
      setTimeout,
      require(module) {
        if (module === '@/features/activities/routeDistance') return routeDistance;
        assert.equal(module, 'expo-sqlite');
        return { openDatabaseAsync: async () => adapter };
      },
    });
    return exports;
  };
}

function location(timestamp, latitude, accuracy = 5, speed = 6) {
  return { timestamp, coords: { latitude, longitude: -86, accuracy, speed } };
}

test('preserves paused time and separates resumed background segments', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('background', 1_000);
  await store.appendRideLocations([location(2_000, 21.001), location(1_000, 21)], 'background');
  await store.appendRideLocations([location(2_000, 21.5), location(2_100, 21.5, 50)], 'background');
  await store.pauseRideDraft(3_000);
  await store.appendRideLocations([location(3_500, 21.5)], 'background');

  const firstDistance = (await store.loadRideDraft()).distanceM;
  await store.beginRideSegment('background', 10_000);
  await store.appendRideLocations([location(9_000, 21.5), location(10_000, 21.1)], 'background');
  assert.equal((await store.loadRideDraft()).distanceM, firstDistance);
  await store.appendRideLocations([location(11_000, 21.101)], 'background');
  await store.pauseRideDraft(12_000);

  const draft = await store.loadRideDraft();
  assert.equal(draft.durationMs, 4_000);
  assert.ok(Math.abs(draft.distanceM - 2 * firstDistance) < 0.01);
  const route = await store.loadDraftRoute();
  assert.equal(JSON.stringify(route.map(segment => segment.map(point => point.timestamp))),
    '[[1000,2000],[10000,11000]]');
});

test('recovers the last durable checkpoint after reopening an interrupted ride', async t => {
  const openStore = testDatabase(t);
  const store = openStore();
  await store.beginRideSegment('background', 1_000);
  await store.appendRideLocations([location(2_000, 21), location(3_000, 21.001)], 'background');

  const reopened = openStore();
  const recovered = await reopened.pauseRideDraft();
  assert.equal(recovered.segmentStart, null);
  assert.equal(recovered.durationMs, 2_000);
  assert.equal((await reopened.loadDraftRoute())[0].length, 2);

  await reopened.clearRideDraft();
  assert.equal(await reopened.loadRideDraft(), null);
  assert.equal((await reopened.loadDraftRoute()).length, 0);
});

test('records in foreground after fallback and checkpoints a timer-only ride', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('background', 1_000);
  await store.setSegmentToForeground(1_000);
  await store.appendRideLocations([location(2_000, 21.5)], 'background');
  await store.appendRideLocations([location(2_000, 21.5)], 999);
  await store.appendRideLocations([location(2_000, 21)], 1_000);
  assert.equal((await store.loadDraftRoute())[0].length, 1);

  await store.clearRideDraft();
  await store.beginRideSegment('timer', 3_000);
  await store.checkpointRide(3_000, 8_000);
  assert.equal((await store.pauseRideDraft()).durationMs, 5_000);
  assert.equal((await store.loadDraftRoute()).length, 0);
});

test('loads only new map points from the selected draft and preserves segment boundaries', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('background', 1_000);
  await store.appendRideLocations([location(1_000, 21), location(2_000, 21.001)], 'background');
  const first = await store.loadDraftRoutePoints(1_000);
  assert.equal(first.length, 2);
  assert.equal((await store.loadDraftRoutePoints(1_000, first[1])).length, 0);
  assert.equal((await store.loadDraftRoutePoints(2_000)).length, 0);
  assert.equal((await store.loadDraftRoutePoints(1_000, undefined, first[0])).length, 1);

  await store.pauseRideDraft(3_000);
  await store.beginRideSegment('background', 4_000);
  await store.appendRideLocations([location(4_000, 21.1)], 'background');
  const next = await store.loadDraftRoutePoints(1_000, first[1]);
  assert.equal(next.length, 1);
  assert.equal(next[0].segment, 2);
  assert.equal(next[0].timestamp, 4_000);
});

test('records short movements and filters nearby fixes when stopped', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('foreground', 1_000);
  await store.appendRideLocations([
    location(1_000, 21),
    location(2_000, 21.00002, 5, 2),
    location(3_000, 21.00004, 5, 2),
    location(4_000, 21.00006, 5, 0),
  ], 1_000);

  const [route] = await store.loadDraftRoute();
  const draft = await store.loadRideDraft();
  assert.equal(JSON.stringify(route.map(point => point.timestamp)), '[1000,2000,3000]');
  assert.ok(draft.distanceM > 4 && draft.distanceM < 5);
  assert.equal(draft.speedKmh, 0);
});

test('automatically pauses from the first stationary fix and resumes in a new route segment', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('background', 1_000);
  await store.appendRideLocations([
    location(1_000, 21),
    location(2_000, 21.001),
    ...Array.from({ length: 9 }, (_, index) => location(3_000 + index * 1_000, 21.0011, 5, 0)),
  ], 'background');

  const paused = await store.loadRideDraft();
  assert.equal(paused.segmentStart, 1_000);
  assert.equal(paused.activeSince, null);
  assert.equal(store.rideElapsedMs(paused, 15_000), 2_000);
  assert.equal((await store.loadDraftRoute())[0].length, 2);
  await store.checkpointRide(1_000, 15_000);

  await store.appendRideLocations([location(16_000, 21.0011), location(17_000, 21.0021)], 'background');
  const resumed = await store.loadRideDraft();
  assert.equal(resumed.activeSince, 16_000);
  assert.equal(store.rideElapsedMs(resumed, 18_000), 4_000);
  assert.ok(Math.abs(resumed.distanceM - 2 * paused.distanceM) < 0.01);
  assert.equal(JSON.stringify((await store.loadDraftRoute()).map(segment => segment.map(point => point.timestamp))),
    '[[1000,2000],[16000,17000]]');
  assert.equal((await store.pauseRideDraft(18_000)).durationMs, 4_000);
});

test('does not interpret poor GPS or gaps in fixes as continuous stationary time', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('foreground', 1_000);
  await store.appendRideLocations([
    location(1_000, 21, 5, 0),
    location(3_000, 21, 50, 0),
    location(8_000, 21, 50, 0),
    location(10_000, 21, 5, 0),
    location(12_000, 21.00004, 5, 2),
    location(16_000, 21.00004, 5, 0),
    location(20_000, 21.00008, 5, 2),
  ], 1_000);
  const active = await store.loadRideDraft();
  assert.equal(active.activeSince, 1_000);
  assert.equal(store.rideElapsedMs(active, 20_000), 19_000);
});

test('manual pause during an automatic pause prevents motion from resuming the ride', async t => {
  const store = testDatabase(t)();
  await store.beginRideSegment('foreground', 1_000);
  await store.appendRideLocations([
    location(1_000, 21),
    ...Array.from({ length: 9 }, (_, index) => location(2_000 + index * 1_000, 21, 5, 0)),
  ], 1_000);
  const paused = await store.pauseRideDraft(15_000);
  assert.equal(paused.segmentStart, null);
  assert.equal(paused.durationMs, 1_000);
  await store.appendRideLocations([location(16_000, 21.001)], 1_000);
  assert.equal((await store.loadRideDraft()).segmentStart, null);
});

test('background fixes continue after reopening and a long GPS gap does not add a straight line', async t => {
  const openStore = testDatabase(t);
  const store = openStore();
  await store.beginRideSegment('background', 1_000);
  await store.appendRideLocations([location(1_000, 21), location(2_000, 21.00005)], 'background');
  const reopened = openStore();
  await reopened.appendRideLocations([location(3_000, 21.0001), location(4_000, 21.00015, -1)], 'background');
  const distanceBeforeGap = (await reopened.loadRideDraft()).distanceM;
  await reopened.appendRideLocations([location(45_000, 21.01), location(46_000, 21.01005)], 'background');
  const route = await reopened.loadDraftRoute();
  assert.equal(JSON.stringify(route.map(segment => segment.map(point => point.timestamp))),
    '[[1000,2000,3000],[45000,46000]]');
  assert.ok(Math.abs((await reopened.loadRideDraft()).distanceM - distanceBeforeGap * 1.5) < 0.1);
});
