/* global __dirname */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

function load(file, resolve) {
  const source = readFileSync(join(__dirname, '../src/features/activities', file + '.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  runInNewContext(outputText, { exports, require: resolve });
  return exports;
}

const { bestRouteTimes, groupWeeks } = load('progress', module => {
  assert.equal(module, './routeDistance');
  return load('routeDistance');
});

test('keeps the series during the current week and resets it after a full missed week', () => {
  const activities = [4, 11].map(day => ({
    startedAt: new Date(2026, 10, day, 13).getTime(),
    durationMs: 3600000,
    distanceM: day === 4 ? 25000 : null,
  }));
  const { weeks, streak } = groupWeeks(activities, new Date(2026, 10, 16, 12));
  assert.equal(weeks.length, 12);
  assert.equal(weeks[9].distance, 25000);
  assert.equal(weeks[10].duration, 3600000);
  assert.equal(weeks[10].distance, 0);
  assert.equal(weeks[11].count, 0);
  assert.equal(streak, 2);
  assert.equal(groupWeeks(activities, new Date(2026, 10, 23, 12)).streak, 0);
});

function point(meters, seconds) {
  return { latitude: 0, longitude: meters / 6371000 * 180 / Math.PI, timestamp: seconds * 1000 };
}

test('interpolates the fastest distance, including a start between GPS fixes', () => {
  const route = [[point(0, 0), point(4000, 480), point(7000, 600)]];
  const [five, ten] = bestRouteTimes(route);
  assert.ok(Math.abs(five - 360000) < 0.001);
  assert.equal(ten, Infinity);
});

test('never combines separate GPS segments for a personal record', () => {
  const route = [[point(0, 0), point(3000, 120)], [point(3000, 300), point(6000, 420)]];
  assert.equal(bestRouteTimes(route)[0], Infinity);
});
