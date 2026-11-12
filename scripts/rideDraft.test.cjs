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

function testDatabase(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  const adapter = {
    execAsync: async sql => database.exec(sql),
    runAsync: async (sql, ...params) => database.prepare(sql).run(...params),
    getFirstAsync: async (sql, ...params) => database.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql, ...params) => database.prepare(sql).all(...params),
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
      require(module) {
        assert.equal(module, 'expo-sqlite');
        return { openDatabaseAsync: async () => adapter };
      },
    });
    return exports;
  };
}

function location(timestamp, latitude, accuracy = 5) {
  return { timestamp, coords: { latitude, longitude: -86, accuracy, speed: 6 } };
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

  await store.pauseRideDraft(3_000);
  await store.beginRideSegment('background', 4_000);
  await store.appendRideLocations([location(4_000, 21.1)], 'background');
  const next = await store.loadDraftRoutePoints(1_000, first[1]);
  assert.equal(next.length, 1);
  assert.equal(next[0].segment, 2);
  assert.equal(next[0].timestamp, 4_000);
});
