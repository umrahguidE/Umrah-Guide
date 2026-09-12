import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrackingRuntime } from '../src/ui/tracking-runtime.js';
import { transition, initialState, EV } from '../src/engine/machine.js';

test('sync is safe with no session and with manual mode (app start-up path)', () => {
  const readings = [];
  const rt = createTrackingRuntime({ simulate: true, onReading: (r) => readings.push(r) });
  rt.sync(null);
  rt.sync(transition(initialState(), { type: EV.START, gender: 'male', now: '2026-09-11T07:00:00Z' }).session);
  assert.deepEqual(readings, []);
});
