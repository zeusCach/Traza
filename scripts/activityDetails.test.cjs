/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/database/activities.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
});

function activityStore(initial, key = 'traza.activities.v2.ana') {
  const stored = new Map([[key, JSON.stringify(initial)]]);
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require(name) {
      assert.equal(name, '@react-native-async-storage/async-storage');
      return {
        getItem: async key => stored.get(key) ?? null,
        setItem: async (key, value) => { stored.set(key, value); },
      };
    },
  });
  return exports;
}

test('loads legacy rides and saves names and effort alongside metrics', async () => {
  const legacy = { startedAt: 1000, durationMs: 8000, distanceM: null };
  const store = activityStore([legacy]);
  assert.equal((await store.loadActivities('ana'))[0].effort, undefined);

  const newRide = { ...legacy, startedAt: 3000, name: 'Vuelta de descanso', effort: 'moderate' };
  await store.saveActivity('ana', newRide, []);
  const history = await store.loadActivities('ana');
  assert.equal(history[0].name, newRide.name);
  assert.equal(history[0].effort, newRide.effort);
  assert.equal(history[1].durationMs, legacy.durationMs);
});

test('keeps unassigned legacy rides separate and isolates accounts with the same ride timestamp', async () => {
  const ride = { startedAt: 1000, durationMs: 8000, distanceM: 50 };
  const store = activityStore([ride], 'traza.activities.v1');
  const route = [[{ latitude: 21, longitude: -87, timestamp: 1000 }]];
  assert.equal((await store.loadActivities('ana')).length, 0);
  await store.saveActivity('ana', ride, route);
  assert.equal((await store.loadActivities('beto')).length, 0);
  assert.equal((await store.loadActivityRoute('beto', ride.startedAt)).length, 0);
  await store.saveActivity('beto', { ...ride, name: 'Otra cuenta' }, []);
  assert.equal((await store.loadActivities('ana'))[0].name, undefined);
  assert.equal((await store.loadActivityRoute('ana', ride.startedAt)).length, 1);
});

test('keeps metadata edits and a concurrent save without rewriting the edited route', async () => {
  const ride = { startedAt: 1000, durationMs: 8000, distanceM: 42, name: 'Rodada' };
  const route = [[{ latitude: 21, longitude: -87, timestamp: 2000 }]];
  const store = activityStore([]);
  await store.saveActivity('ana', ride, route);

  await Promise.all([
    store.updateRideDetails('ana', ride.startedAt, { name: undefined, effort: 'hard' }),
    store.saveActivity('ana', { ...ride, startedAt: 3000, name: 'Otra rodada' }, []),
  ]);

  const history = await store.loadActivities('ana');
  assert.equal(history[0].name, 'Otra rodada');
  assert.equal(history[1].name, undefined);
  assert.equal(history[1].effort, 'hard');
  assert.equal(history[1].distanceM, ride.distanceM);
  assert.equal((await store.loadActivityRoute('ana', ride.startedAt))[0][0].timestamp, 2000);
});
