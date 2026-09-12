import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStepDetector, headingFromOrientation, calibrateStepLength } from '../src/engine/motion.js';

// 60 Hz accelerometer samples of someone walking at `hz` steps per second.
function walkSignal(detector, { seconds, hz = 2, amplitude = 3, noise = 0 }) {
  for (let i = 0; i < seconds * 60; i++) {
    const t = i * (1000 / 60);
    const a = 9.81 + amplitude * Math.sin(2 * Math.PI * hz * (t / 1000)) + (noise ? (Math.random() - 0.5) * 2 * noise : 0);
    detector.update(0, 0, a, t);
  }
  return detector.steps;
}

test('counts walking steps within a few per cent', () => {
  const steps = walkSignal(createStepDetector(), { seconds: 10, hz: 2 });
  assert.ok(Math.abs(steps - 20) <= 2, `counted ${steps}, expected about 20`);
});

test('survives noisy sensor data', () => {
  const steps = walkSignal(createStepDetector(), { seconds: 20, hz: 1.8, amplitude: 2.5, noise: 0.4 });
  assert.ok(Math.abs(steps - 36) <= 5, `counted ${steps}, expected about 36`);
});

test('standing still counts nothing', () => {
  const detector = createStepDetector();
  for (let i = 0; i < 1200; i++) detector.update(0, 0, 9.81 + (Math.random() - 0.5) * 0.3, i * (1000 / 60));
  assert.equal(detector.steps, 0);
});

test('heading comes from the compass on iOS and from alpha elsewhere', () => {
  assert.equal(headingFromOrientation({ webkitCompassHeading: 120, alpha: 30 }), 120);
  assert.equal(headingFromOrientation({ alpha: 90 }), 270);
  assert.equal(headingFromOrientation({ alpha: 0 }), 0);
  assert.equal(headingFromOrientation({}), null);
});

test('step length is learned from a well measured lap, and absurd values rejected', () => {
  assert.equal(calibrateStepLength(390, 520), 0.75);
  assert.equal(calibrateStepLength(390, 90), null, 'too few steps to trust');
  assert.equal(calibrateStepLength(390, 200), null, 'almost 2 m per step is not walking');
  assert.equal(calibrateStepLength(0, 500), null);
});
