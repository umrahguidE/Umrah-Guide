import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTawafTracker, createSaiTracker, createPositionFilter, HARAM_GEO, STALE_AFTER_MS, confidenceFor, sectorAt, offsetFrom } from '../src/engine/tracking.js';
import { destination, lerpPoint } from '../src/engine/geo.js';

const B = HARAM_GEO.blackStoneBearingDeg;
let clock = 0;
const tick = (ms = 1000) => (clock += ms);

// Walks around the Kaaba at about 1.5 m/s. Positive degrees = anticlockwise = the Tawaf direction.
function walk(tracker, { fromBearing, degrees, stepDeg = 3, radius = 30, accuracy = 5, jitterM = 0 }) {
  let reading;
  const dir = Math.sign(degrees) || 1;
  for (let d = 0; d <= Math.abs(degrees); d += stepDeg) {
    const p = destination(HARAM_GEO.kaabaCenter, fromBearing - dir * d, radius + (jitterM ? (Math.random() - 0.5) * 2 * jitterM : 0));
    reading = tracker.update({ ...p, accuracy, timestamp: tick() });
  }
  return reading;
}

function saiWalk(tracker, from, to, { accuracy = 5, stepM = 1.4 } = {}) {
  const dir = Math.sign(to - from) || 1;
  const stepT = (dir * stepM) / tracker.lengthM;
  let reading;
  for (let t = from; dir > 0 ? t <= to + 1e-9 : t >= to - 1e-9; t += stepT) {
    const p = lerpPoint(HARAM_GEO.safa, HARAM_GEO.marwah, Math.min(1, Math.max(0, t)));
    reading = tracker.update({ ...p, accuracy, timestamp: tick() });
  }
  return reading;
}

test('position filter drops inaccurate fixes, rejects teleports and smooths noise', () => {
  const filter = createPositionFilter({ origin: HARAM_GEO.kaabaCenter });
  assert.equal(filter.update({ ...HARAM_GEO.kaabaCenter, accuracy: 80, timestamp: tick() }).ok, false);
  const start = destination(HARAM_GEO.kaabaCenter, 90, 30);
  assert.equal(filter.update({ ...start, accuracy: 5, timestamp: tick() }).ok, true);
  const teleport = destination(HARAM_GEO.kaabaCenter, 270, 30);
  assert.equal(filter.update({ ...teleport, accuracy: 5, timestamp: tick() }).reason, 'jump');
  // Three fixes agreeing on the new place mean our estimate was the wrong one.
  filter.update({ ...teleport, accuracy: 5, timestamp: tick() });
  assert.equal(filter.update({ ...teleport, accuracy: 5, timestamp: tick() }).ok, true);

  const noisy = createPositionFilter({ origin: HARAM_GEO.kaabaCenter });
  let last;
  for (let i = 0; i < 25; i++) {
    const p = destination(HARAM_GEO.kaabaCenter, 90 + (Math.random() - 0.5) * 30, 30 + (Math.random() - 0.5) * 20);
    last = noisy.update({ ...p, accuracy: 12, timestamp: tick() });
  }
  const truth = destination(HARAM_GEO.kaabaCenter, 90, 30);
  const truthLocal = createPositionFilter({ origin: HARAM_GEO.kaabaCenter }).update({ ...truth, accuracy: 1, timestamp: tick() });
  assert.ok(Math.hypot(last.x - truthLocal.x, last.y - truthLocal.y) < 8, 'smoothed position stays near the truth');
});

test('a round is suggested only after a full anticlockwise circuit past every corner', () => {
  const tr = createTawafTracker({ now: clock });
  let r = walk(tr, { fromBearing: B, degrees: 10 });
  assert.equal(r.nearStart, true);
  assert.equal(r.suggestCompletion, false, 'standing at the start line is not a finished round');
  r = walk(tr, { fromBearing: B - 10, degrees: 320 });
  assert.equal(r.suggestCompletion, false, '330 degrees is not yet a round');
  assert.deepEqual(r.checkpoints, { iraqi: true, shami: true, yemeni: true });
  r = walk(tr, { fromBearing: B - 330, degrees: 30 });
  assert.equal(r.suggestCompletion, true);
  assert.ok(r.progress > 0.9, `progress ${r.progress}`);
  assert.equal(r.mode, 'gps');
  assert.equal(r.confidence, 'medium', 'GPS alone is medium confidence');
});

test('turning back before the last corner does not count as a round', () => {
  const tr = createTawafTracker({ now: clock });
  walk(tr, { fromBearing: B, degrees: 200 }); // out to the Shami side
  const r = walk(tr, { fromBearing: B - 200, degrees: -200 }); // and back the way they came
  assert.equal(r.checkpoints.yemeni, false);
  assert.equal(r.suggestCompletion, false);
});

test('standing still with jittery GPS never suggests a round', () => {
  const tr = createTawafTracker({ now: clock });
  for (let i = 0; i < 200; i++) {
    const p = destination(HARAM_GEO.kaabaCenter, B + (Math.random() - 0.5) * 40, 25 + (Math.random() - 0.5) * 20);
    tr.update({ ...p, accuracy: 15, timestamp: tick(500) });
  }
  const r = tr.reading;
  assert.equal(r.suggestCompletion, false);
  assert.ok(r.progress < 0.5, `jitter must not accumulate a round (${r.progress})`);
});

test('the compass alone can count a round when GPS is unusable indoors', () => {
  const tr = createTawafTracker({ now: clock });
  let r;
  for (let d = 0; d <= 360; d += 5) r = tr.updateHeading((B - 90 - d + 720) % 360, tick(400));
  assert.equal(r.mode, 'compass');
  assert.equal(r.status, 'ok');
  assert.equal(r.suggestCompletion, true);
  assert.equal(r.confidence, 'medium');
});

test('GPS and compass agreeing give high confidence; disagreeing gives low', () => {
  const agree = createTawafTracker({ now: clock });
  for (let d = 0; d <= 360; d += 3) {
    const p = destination(HARAM_GEO.kaabaCenter, B - d, 30);
    const t = tick(600);
    agree.update({ ...p, accuracy: 6, timestamp: t });
    agree.updateHeading((B - 90 - d + 720) % 360, t);
  }
  assert.equal(agree.reading.mode, 'gps+compass');
  assert.equal(agree.reading.agreement, 'agree');
  assert.equal(agree.reading.confidence, 'high');
  assert.equal(agree.reading.suggestCompletion, true);

  const conflict = createTawafTracker({ now: clock });
  for (let d = 0; d <= 360; d += 3) {
    const p = destination(HARAM_GEO.kaabaCenter, B - d, 30);
    const t = tick(600);
    conflict.update({ ...p, accuracy: 6, timestamp: t });
    conflict.updateHeading(B - 90, t); // phone never turned: compass disagrees
  }
  assert.equal(conflict.reading.agreement, 'conflict');
  assert.equal(conflict.reading.confidence, 'low');
});

test('too few steps for a round holds the suggestion back', () => {
  const tr = createTawafTracker({ now: clock });
  tr.updateSteps(0, tick());
  walk(tr, { fromBearing: B, degrees: 360 });
  tr.updateSteps(12, tick());
  assert.equal(tr.reading.suggestCompletion, false, 'a round cannot happen in 12 steps');
  tr.updateSteps(260, tick());
  assert.equal(tr.reading.suggestCompletion, true);
  assert.equal(tr.reading.stepsThisRound, 260);
});

test('the tracker names the part of the Kaaba you are beside', () => {
  assert.equal(sectorAt(0).id, 'black-stone');
  assert.equal(sectorAt(120).id, 'hijr');
  assert.equal(sectorAt(270).id, 'yemeni');
  assert.equal(sectorAt(300).id, 'rabbana');
  assert.equal(offsetFrom(B - 90, B), 90);
  const tr = createTawafTracker({ now: clock });
  walk(tr, { fromBearing: B, degrees: 145 });
  assert.equal(tr.reading.sector.id, 'hijr');
  assert.match(tr.reading.sector.tip, /OUTSIDE/);
});

test('poor accuracy, distance and silence are reported, never guessed', () => {
  const tr = createTawafTracker({ now: clock });
  walk(tr, { fromBearing: B, degrees: 90 });
  const before = tr.reading.progress;
  const r = walk(tr, { fromBearing: B - 90, degrees: 200, accuracy: 60 });
  assert.equal(r.status, 'weak');
  assert.equal(r.progress, before, 'inaccurate fixes never move progress');

  const far = createTawafTracker({ now: clock });
  assert.equal(far.update({ ...destination(HARAM_GEO.kaabaCenter, 0, 2000), accuracy: 5, timestamp: tick() }).status, 'out_of_area');

  const t0 = 5_000_000;
  const quiet = createTawafTracker({ now: t0 });
  assert.equal(quiet.reading.status, 'waiting');
  assert.equal(quiet.checkStale(t0 + STALE_AFTER_MS + 1).status, 'weak');
  assert.equal(confidenceFor(undefined), 'low');
});

test('startRound resets the count for the next round', () => {
  const tr = createTawafTracker({ now: clock });
  walk(tr, { fromBearing: B, degrees: 360 });
  tr.startRound();
  assert.equal(tr.reading.progress, 0);
  assert.equal(tr.reading.checkpoints.iraqi, false);
  const r = walk(tr, { fromBearing: B, degrees: 90 });
  assert.ok(r.progress > 0.15 && r.progress < 0.3);
});

test('outbound lap: progress, green markers and arrival at Marwah', () => {
  const tr = createSaiTracker({ direction: 'SAFA_TO_MARWAH', now: clock });
  assert.ok(tr.lengthM > 300 && tr.lengthM < 450);
  let r = saiWalk(tr, 0, 0.03);
  assert.ok(r.progress < 0.06);
  assert.equal(r.suggestCompletion, false);
  assert.equal(saiWalk(tr, 0.03, 0.15).green, 'ahead');
  assert.equal(saiWalk(tr, 0.15, 0.25).green, 'inside');
  assert.equal(saiWalk(tr, 0.25, 0.5).green, 'passed');
  r = saiWalk(tr, 0.5, 1);
  assert.equal(r.suggestCompletion, true);
  assert.equal(r.mode, 'gps');
});

test('return lap measures progress from Marwah towards Safa', () => {
  const tr = createSaiTracker({ direction: 'MARWAH_TO_SAFA', now: clock });
  let r = saiWalk(tr, 1, 0.97);
  assert.ok(r.progress < 0.06);
  assert.equal(r.suggestCompletion, false);
  assert.equal(saiWalk(tr, 0.97, 0.36).green, 'ahead');
  assert.equal(saiWalk(tr, 0.36, 0.1).green, 'passed');
  r = saiWalk(tr, 0.1, 0);
  assert.equal(r.suggestCompletion, true);
});

test('steps carry the lap when GPS fails under the covered Mas’a', () => {
  const tr = createSaiTracker({ direction: 'SAFA_TO_MARWAH', stepLengthM: 0.75, now: clock });
  tr.updateSteps(0, tick());
  const steps = Math.round(tr.lengthM / 0.75);
  let r;
  for (let s = 10; s <= steps; s += 10) r = tr.updateSteps(s, tick(7000));
  assert.equal(r.mode, 'steps');
  assert.equal(r.status, 'ok');
  assert.equal(r.suggestCompletion, true);
  assert.equal(r.confidence, 'low', 'steps alone are the least certain source');
});

test('GPS and steps disagreeing is reported as low confidence', () => {
  const tr = createSaiTracker({ direction: 'SAFA_TO_MARWAH', now: clock });
  tr.updateSteps(0, tick());
  saiWalk(tr, 0, 0.2);
  const r = tr.updateSteps(500, tick());
  assert.equal(r.agreement, 'conflict');
  assert.equal(r.confidence, 'low');
  assert.equal(r.suggestCompletion, false);
});

test('Sa’i positions well off the Mas’a are out of area', () => {
  const tr = createSaiTracker({ direction: 'SAFA_TO_MARWAH', now: clock });
  assert.equal(tr.update({ ...destination(HARAM_GEO.safa, 90, 300), accuracy: 5, timestamp: tick() }).status, 'out_of_area');
});
