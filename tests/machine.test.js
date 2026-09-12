import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transition, initialState, EV, RitualError, toRecords, IHRAM_CHECKS } from '../src/engine/machine.js';
import { STAGE, STAGE_ORDER, progressOf, saiDirection } from '../src/engine/stages.js';

let tick = 0;
const at = () => new Date(Date.UTC(2026, 8, 11, 7, 0, 0) + 60_000 * tick++).toISOString();
const run = (state, ...events) => events.reduce((s, e) => transition(s, { now: at(), ...e }), state);
const stageOf = (st) => st.session.current_stage;

function toTawafReady(gender = 'male') {
  let st = run(initialState(), { type: EV.START, gender });
  st = run(st, { type: EV.NEXT });
  for (const key of IHRAM_CHECKS) st = run(st, { type: EV.TOGGLE_CHECK, key, value: true });
  return run(st, { type: EV.NEXT }, { type: EV.NEXT }, { type: EV.NEXT });
}
function tawafTo(st, round) {
  st = run(st, { type: EV.START_TAWAF });
  for (let n = 1; n < round; n++) st = run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: n });
  return st;
}
const completeTawaf = (st) => run(tawafTo(st, 7), { type: EV.CONFIRM_TAWAF_ROUND, round: 7 });
const toSafa = (st) => run(completeTawaf(st), { type: EV.NEXT }, { type: EV.NEXT }, { type: EV.NEXT });
function completeSai(st) {
  st = run(st, { type: EV.START_SAI });
  for (let n = 1; n <= 7; n++) st = run(st, { type: EV.CONFIRM_SAI_LAP, lap: n });
  return st;
}

function expectError(fn, code) {
  assert.throws(fn, (err) => err instanceof RitualError && err.code === code);
}

test('walks the full Umrah for a man and records every round and lap', () => {
  let st = toTawafReady('male');
  assert.equal(stageOf(st), STAGE.TAWAF_READY);
  st = completeSai(toSafa(st));
  assert.equal(stageOf(st), STAGE.SAI_COMPLETE);
  st = run(st, { type: EV.NEXT }, { type: EV.CONFIRM_HAIR, method: 'shave' }, { type: EV.NEXT });

  assert.equal(stageOf(st), STAGE.UMRAH_COMPLETE);
  assert.equal(st.session.status, 'complete');
  assert.ok(st.session.completed_at && st.session.ihram_exited_at && st.session.two_rakah_at && st.session.zamzam_at);

  const rec = toRecords(st.session);
  assert.deepEqual(rec.tawaf_rounds.map((r) => r.round_number), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(rec.tawaf_rounds.every((r) => r.confirmed && r.started_at && r.completed_at && r.tawaf_session_id === rec.tawaf_session.id));
  assert.equal(rec.tawaf_session.status, 'complete');
  assert.deepEqual(rec.sai_laps.map((l) => l.lap_number), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(rec.sai_laps[0].start_location, 'SAFA');
  assert.equal(rec.sai_laps.at(-1).end_location, 'MARWAH');
  assert.equal(rec.umrah_session.hair_method, 'shave');
  assert.equal(rec.umrah_session.status, 'complete');
});

test('the journey visits every stage exactly once, in order', () => {
  const seen = [];
  const note = (st) => {
    if (seen.at(-1) !== stageOf(st)) seen.push(stageOf(st));
    return st;
  };
  let st = note(run(initialState(), { type: EV.START, gender: 'female' }));
  st = note(run(st, { type: EV.NEXT }));
  for (const key of IHRAM_CHECKS) st = note(run(st, { type: EV.TOGGLE_CHECK, key, value: true }));
  for (let i = 0; i < 3; i++) st = note(run(st, { type: EV.NEXT }));
  st = note(run(st, { type: EV.START_TAWAF }));
  for (let n = 1; n <= 7; n++) st = note(run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: n }));
  for (let i = 0; i < 3; i++) st = note(run(st, { type: EV.NEXT }));
  st = note(run(st, { type: EV.START_SAI }));
  for (let n = 1; n <= 7; n++) st = note(run(st, { type: EV.CONFIRM_SAI_LAP, lap: n }));
  st = note(run(st, { type: EV.NEXT }));
  st = note(run(st, { type: EV.CONFIRM_HAIR, method: 'shorten' }));
  note(run(st, { type: EV.NEXT }));
  assert.deepEqual(seen, STAGE_ORDER.slice(1));
});

test('Ihram cannot be left until all three checks are ticked', () => {
  let st = run(initialState(), { type: EV.START, gender: 'male' }, { type: EV.NEXT });
  st = run(st, { type: EV.TOGGLE_CHECK, key: 'prepared', value: true }, { type: EV.TOGGLE_CHECK, key: 'intention', value: true });
  expectError(() => run(st, { type: EV.NEXT }), 'IHRAM_INCOMPLETE');
  st = run(st, { type: EV.TOGGLE_CHECK, key: 'talbiyah', value: true }, { type: EV.NEXT });
  assert.equal(stageOf(st), STAGE.TALBIYAH);
});

test('a duplicate tap cannot confirm the next round', () => {
  let st = tawafTo(toTawafReady(), 3);
  st = run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: 3, expect: 'TAWAF_ROUND_3' });
  assert.equal(stageOf(st), 'TAWAF_ROUND_4');
  expectError(() => run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: 3 }), 'STALE');
  expectError(() => run(st, { type: EV.CONFIRM_TAWAF_ROUND, expect: 'TAWAF_ROUND_3' }), 'STALE');
  assert.equal(st.session.tawaf.rounds.length, 3);
});

test('rounds and laps can only be completed by confirming them', () => {
  const st = tawafTo(toTawafReady(), 1);
  expectError(() => run(st, { type: EV.NEXT }), 'NO_NEXT');
  expectError(() => run(st, { type: EV.CONFIRM_SAI_LAP, lap: 1 }), 'WRONG_STAGE');
  expectError(() => run(toTawafReady(), { type: EV.START_SAI }), 'WRONG_STAGE');
});

test('pause blocks confirmation; correction still works while paused', () => {
  let st = run(tawafTo(toTawafReady(), 4), { type: EV.PAUSE });
  assert.equal(st.session.paused, true);
  expectError(() => run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: 4 }), 'PAUSED');
  expectError(() => run(st, { type: EV.PAUSE }), 'ALREADY_PAUSED');
  st = run(st, { type: EV.CORRECT_TAWAF_ROUND, round: 3 });
  assert.equal(stageOf(st), 'TAWAF_ROUND_3');
  st = run(st, { type: EV.RESUME });
  assert.equal(st.session.paused, false);
  assert.ok(st.session.pauses[0].ended_at);
  expectError(() => run(toTawafReady(), { type: EV.PAUSE }), 'NOT_PAUSABLE');
});

test('correcting down drops the rounds from the corrected one onwards', () => {
  let st = tawafTo(toTawafReady(), 5);
  st = run(st, { type: EV.CORRECT_TAWAF_ROUND, round: 3 });
  assert.equal(stageOf(st), 'TAWAF_ROUND_3');
  assert.deepEqual(st.session.tawaf.rounds.map((r) => r.round_number), [1, 2]);
  assert.deepEqual(st.session.corrections.map(({ kind, from, to }) => ({ kind, from, to })), [{ kind: 'tawaf', from: 5, to: 3 }]);
  st = run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: 3 });
  assert.equal(stageOf(st), 'TAWAF_ROUND_4');
});

test('correcting up fills the skipped rounds as corrections', () => {
  let st = tawafTo(toTawafReady(), 2);
  st = run(st, { type: EV.CORRECT_TAWAF_ROUND, round: 5 });
  const rounds = st.session.tawaf.rounds;
  assert.deepEqual(rounds.map((r) => r.round_number), [1, 2, 3, 4]);
  assert.deepEqual(rounds.map((r) => r.source), ['confirmed', 'correction', 'correction', 'correction']);
  expectError(() => run(st, { type: EV.CORRECT_TAWAF_ROUND, round: 8 }), 'BAD_COUNT');
});

test('Tawaf can be recounted until Sa’i starts, then not any more', () => {
  let st = run(completeTawaf(toTawafReady()), { type: EV.NEXT }, { type: EV.NEXT });
  assert.equal(stageOf(st), STAGE.ZAMZAM);
  assert.ok(st.session.two_rakah_at);
  const back = run(st, { type: EV.CORRECT_TAWAF_ROUND, round: 7 });
  assert.equal(stageOf(back), 'TAWAF_ROUND_7');
  assert.equal(back.session.two_rakah_at, null);
  assert.equal(back.session.tawaf.status, 'in_progress');

  st = run(st, { type: EV.NEXT }, { type: EV.START_SAI });
  expectError(() => run(st, { type: EV.CORRECT_TAWAF_ROUND, round: 6 }), 'NOT_CORRECTABLE');
});

test('Sa’i laps alternate direction, start at Safa and end at Marwah', () => {
  const dirs = [1, 2, 3, 4, 5, 6, 7].map((n) => saiDirection(n).key);
  assert.deepEqual(dirs, ['SAFA_TO_MARWAH', 'MARWAH_TO_SAFA', 'SAFA_TO_MARWAH', 'MARWAH_TO_SAFA', 'SAFA_TO_MARWAH', 'MARWAH_TO_SAFA', 'SAFA_TO_MARWAH']);
  let st = run(toSafa(toTawafReady()), { type: EV.START_SAI });
  for (let n = 1; n <= 4; n++) st = run(st, { type: EV.CONFIRM_SAI_LAP, lap: n });
  st = run(st, { type: EV.CORRECT_SAI_LAP, lap: 4 });
  assert.deepEqual(st.session.sai.laps.map((l) => `${l.lap_number}:${l.start_location}>${l.end_location}`), ['1:SAFA>MARWAH', '2:MARWAH>SAFA', '3:SAFA>MARWAH']);
});

test('women shorten the hair and cannot record shaving', () => {
  let st = run(completeSai(toSafa(toTawafReady('female'))), { type: EV.NEXT });
  expectError(() => run(st, { type: EV.CONFIRM_HAIR, method: 'shave' }), 'BAD_HAIR_METHOD');
  st = run(st, { type: EV.CONFIRM_HAIR, method: 'shorten' });
  assert.equal(stageOf(st), STAGE.IHRAM_EXIT);
});

test('sessions: one active at a time, reset and restart archive the old one', () => {
  expectError(() => run(initialState(), { type: EV.START }), 'GENDER_REQUIRED');
  let st = run(initialState(), { type: EV.START, gender: 'male' });
  expectError(() => run(st, { type: EV.START, gender: 'male' }), 'SESSION_ACTIVE');
  st = run(st, { type: EV.RESET });
  assert.equal(st.session, null);
  assert.equal(st.archive[0].status, 'abandoned');

  let done = completeSai(toSafa(toTawafReady()));
  done = run(done, { type: EV.NEXT }, { type: EV.CONFIRM_HAIR, method: 'shorten' }, { type: EV.NEXT });
  expectError(() => run(done, { type: EV.NEXT }), 'SESSION_CLOSED');
  const again = run(done, { type: EV.START, gender: 'male' });
  assert.equal(again.archive.at(-1).status, 'complete');
  assert.equal(stageOf(again), STAGE.MIQAT);
});

test('transition never mutates the previous state', () => {
  const st = tawafTo(toTawafReady(), 2);
  const snapshot = JSON.stringify(st);
  run(st, { type: EV.CONFIRM_TAWAF_ROUND, round: 2 });
  assert.equal(JSON.stringify(st), snapshot);
});

test('tracking confidence is stored on the confirmed round', () => {
  const st = run(tawafTo(toTawafReady(), 1), { type: EV.CONFIRM_TAWAF_ROUND, round: 1, confidence: 'high' });
  assert.equal(st.session.tawaf.rounds[0].tracking_confidence, 'high');
  expectError(() => run(st, { type: EV.SET_TRACKING_MODE, mode: 'autopilot' }), 'BAD_MODE');
});

test('overall progress rises monotonically from 0 to 1', () => {
  const values = STAGE_ORDER.slice(1).map(progressOf);
  assert.equal(values[0], 0);
  assert.equal(values.at(-1), 1);
  values.slice(1).forEach((v, i) => assert.ok(v > values[i]));
});
