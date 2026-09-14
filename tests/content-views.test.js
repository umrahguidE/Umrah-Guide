import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/data/content.js';
import { transition, initialState, EV, IHRAM_CHECKS } from '../src/engine/machine.js';
import { STAGE_ORDER } from '../src/engine/stages.js';
import { renderApp, createUiState } from '../src/ui/views.js';
import * as L from '../src/data/voice-lines.js';
import { KAABA_SECTORS } from '../src/engine/tracking.js';
import { defaultPrefs } from '../src/store.js';

test('every dua has what the UI needs, a known category and a review status', () => {
  const categories = new Set(C.DUA_CATEGORIES.map((c) => c.id));
  const ids = new Set();
  for (const d of C.DUAS) {
    assert.ok(!ids.has(d.id), `duplicate id ${d.id}`);
    ids.add(d.id);
    assert.ok(categories.has(d.category), `${d.id} category`);
    assert.ok(C.BASIS_LABEL[d.basis], `${d.id} basis`);
    assert.ok(d.title && Array.isArray(d.contexts) && d.contexts.length, `${d.id} title/contexts`);
    assert.ok(['pending', 'reviewed'].includes(d.review.status), `${d.id} review`);
    if (d.arabic) assert.ok(d.transliteration && d.translation && d.source, `${d.id} needs transliteration, translation and source`);
  }
});

test('nothing is marked scholar-reviewed in this draft', () => {
  const all = [C.CONTENT_META, ...C.DUAS, ...C.IHRAM_GUIDE, ...C.MIQATS, ...C.ROUTES];
  assert.ok(all.every((x) => x.review.status === 'pending'));
});

// Render every screen of a real journey, for both genders.
const ctx = (state, extra = {}) => ({ state, prefs: { ...defaultPrefs(), language: 'en' }, ui: createUiState(), route: { name: '', arg: null }, undoAvailable: true, ...extra });
const render = (c) => String(renderApp(c));

function* journey(gender) {
  let t = 0;
  const now = () => new Date(Date.UTC(2026, 8, 11, 7, t++)).toISOString();
  let st = transition(initialState(), { type: EV.START, gender, now: now() });
  const step = (e) => (st = transition(st, { now: now(), ...e }));
  yield st;
  yield step({ type: EV.NEXT });
  for (const key of IHRAM_CHECKS) step({ type: EV.TOGGLE_CHECK, key, value: true });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.START_TAWAF });
  for (let n = 1; n <= 7; n++) yield step({ type: EV.CONFIRM_TAWAF_ROUND, round: n });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.START_SAI });
  for (let n = 1; n <= 7; n++) yield step({ type: EV.CONFIRM_SAI_LAP, lap: n });
  yield step({ type: EV.NEXT });
  yield step({ type: EV.CONFIRM_HAIR, method: 'shorten' });
  yield step({ type: EV.NEXT });
}

for (const gender of ['male', 'female']) {
  test(`every stage renders for a ${gender === 'male' ? 'man' : 'woman'}`, () => {
    const seen = [];
    for (const st of journey(gender)) {
      const out = render(ctx(st));
      assert.ok(out.length > 500, st.session.current_stage);
      assert.ok(!out.includes('Unknown step'), st.session.current_stage);
      assert.ok(!/undefined|\[object Object\]|NaN/.test(out), `${st.session.current_stage} leaks a bad value`);
      seen.push(st.session.current_stage);
    }
    assert.deepEqual(seen, STAGE_ORDER.slice(1));
  });
}

test('key screens say the right thing', () => {
  const states = [...journey('male')];
  const find = (stage) => render(ctx(states.find((s) => s.session.current_stage === stage)));
  assert.match(find('TAWAF_ROUND_3'), /Round <b>3<\/b>/);
  assert.match(find('TAWAF_ROUND_3'), /Kaaba is on your <b>LEFT<\/b>/);
  assert.match(find('TAWAF_ROUND_2'), /ramal/);
  assert.doesNotMatch(find('TAWAF_ROUND_4'), /ramal/);
  assert.match(find('SAI_1'), /I have reached Marwah/);
  assert.match(find('SAI_2'), /I have reached Safa/);
  assert.match(find('SAI_7'), /final lap/);
  assert.match(find('SAI_4'), /Jog|jog/);
  assert.match(find('SAI_COMPLETE'), /END: MARWAH/);
  assert.match(find('UMRAH_COMPLETE'), /الحمد لله/);

  const women = [...journey('female')];
  const sai = render(ctx(women.find((s) => s.session.current_stage === 'SAI_3')));
  assert.match(sai, /normal pace/);
  assert.doesNotMatch(render(ctx(women.find((s) => s.session.current_stage === 'HAIR'))), /Shave/);
});

test('location suggestions and weak signal show, but never auto-complete', () => {
  let st = [...journey('male')].find((s) => s.session.current_stage === 'TAWAF_ROUND_4');
  st = transition(st, { type: EV.SET_TRACKING_MODE, mode: 'assisted', now: '2026-09-11T09:00:00Z' });
  const ui = createUiState();
  ui.reading = { status: 'ok', confidence: 'high', progress: 0.97, suggestCompletion: true };
  const suggesting = render(ctx(st, { ui }));
  assert.match(suggesting, /Possible round completion/);
  assert.match(suggesting, /Confirm Round 4 complete/);
  ui.reading = { status: 'weak', progress: 0.4, suggestCompletion: false };
  const weak = render(ctx(st, { ui }));
  assert.match(weak, /Tracking signal weak/);
  assert.match(weak, /3 of 7 rounds confirmed \(you are on Round 4\)/);
  assert.match(weak, /Continue manually/);
});

test('pause and correction screens', () => {
  let st = [...journey('male')].find((s) => s.session.current_stage === 'TAWAF_ROUND_4');
  st = transition(st, { type: EV.PAUSE, now: '2026-09-11T09:00:00Z' });
  const paused = render(ctx(st));
  assert.match(paused, /Tawaf.*Round 4 \/ 7/);
  assert.match(paused, /data-action="resume"/);
  assert.doesNotMatch(paused, /data-action="confirm-round"/);
  const ui = createUiState();
  ui.modal = { kind: 'correct', ritual: 'tawaf' };
  const modal = render(ctx(st, { ui }));
  assert.match(modal, /Wrong count\?/);
  assert.match(modal, /Your own certain count is what matters/);
  assert.equal((modal.match(/data-action="correct"/g) ?? []).length, 7);
});

test('user-entered text is escaped', () => {
  const prefs = { ...defaultPrefs(), language: 'en', personalDuas: [{ id: 'x', text: '<img src=x onerror=alert(1)>' }], info: { hotelName: '"><script>alert(1)</script>' } };
  const duas = render({ ...ctx(initialState()), prefs, route: { name: 'duas', arg: null } });
  assert.ok(!duas.includes('<img src=x'));
  assert.ok(duas.includes('&lt;img src=x'));
  const info = render({ ...ctx(initialState()), prefs, route: { name: 'info', arg: null } });
  assert.ok(!info.includes('<script>alert(1)'));
});

test('the round screen shows the corner checkpoints, the sector and which signals are counting', () => {
  let st = [...journey('male')].find((s) => s.session.current_stage === 'TAWAF_ROUND_2');
  st = transition(st, { type: EV.SET_TRACKING_MODE, mode: 'assisted', now: '2026-09-11T09:00:00Z' });
  const ui = createUiState();
  ui.reading = {
    status: 'ok',
    mode: 'gps+compass',
    confidence: 'high',
    progress: 0.6,
    checkpoints: { iraqi: true, shami: true, yemeni: false },
    sector: KAABA_SECTORS.find((s) => s.id === 'hijr'),
    stepsThisRound: 180,
    position: { x: 20, y: 25, accuracyM: 8 },
    suggestCompletion: false,
  };
  const out = render(ctx(st, { ui }));
  assert.match(out, /ʿIrāqī/);
  assert.match(out, /Now beside: Ḥijr Ismāʿīl/);
  assert.match(out, /stay OUTSIDE|Stay OUTSIDE/i);
  assert.match(out, /GPS \+ compass/);
  assert.match(out, /180 steps/);
  assert.match(out, /high confidence/);
  assert.match(out, /<svg class="map/, 'the map is available from the round screen');
});

test('a GPS-free lap still shows progress from steps', () => {
  let st = [...journey('female')].find((s) => s.session.current_stage === 'SAI_3');
  st = transition(st, { type: EV.SET_TRACKING_MODE, mode: 'assisted', now: '2026-09-11T09:00:00Z' });
  const ui = createUiState();
  ui.reading = { status: 'ok', mode: 'steps', confidence: 'low', progress: 0.8, fromSafa: 0.2, green: 'passed', stepsThisLap: 420, suggestCompletion: false };
  const out = render(ctx(st, { ui }));
  assert.match(out, /Steps only/);
  assert.match(out, /420 steps/);
  assert.match(out, /low confidence/);
});

test('the voice guide has a line for every stage and both genders', () => {
  for (const st of journey('male')) {
    const line = L.stageLine(st.session.current_stage, st.session);
    assert.ok(line && line.length > 5, `no voice line for ${st.session.current_stage}`);
  }
  assert.match(L.stageLine('TAWAF_ROUND_7'), /final round/);
  assert.match(L.stageLine('SAI_7'), /final lap/);
  assert.match(L.roundConfirmed(3), /Round 3 confirmed/);
  assert.match(L.lapConfirmed(3), /Marwah/);
  assert.match(L.lapConfirmed(7), /Sa-i complete/);
  assert.match(L.greenMarkers('male'), /Jog/);
  assert.match(L.greenMarkers('female'), /normal pace/);
  for (const sector of KAABA_SECTORS) assert.ok(L.sectorLine(sector).length > 3, sector.id);
});

test('the Miqat picker offers a detailed, grouped route list', () => {
  const prefs = { ...defaultPrefs(), language: 'en', miqatRoute: 'air-pakistan' };
  const out = render({ ...ctx(initialState()), prefs, route: { name: 'miqat', arg: null } });
  assert.match(out, /<optgroup label="✈️ Flying"/);
  assert.match(out, /Pakistan \(Karachi, Lahore, Islamabad, Peshawar\)/);
  assert.match(out, /Yalamlam/);
  assert.match(out, /Watch for my Miqat/);
  assert.ok((out.match(/<option value=/g) ?? []).length >= 25);
});

test('a dua with a recitation offers the reciter — never the phone voice for Arabic', () => {
  const ui = createUiState();
  ui.recitations = {
    quranReciter: 'Maḥmūd Khalīl al-Ḥuṣarī (murattal)',
    sources: ['everyayah.com'],
    files: { 'yemeni-corner': { kind: 'quran', reciter: 'Maḥmūd Khalīl al-Ḥuṣarī (murattal)', label: 'Qur’an 2:201' } },
  };
  const out = render({ ...ctx(initialState(), { ui }), route: { name: 'duas', arg: null } });
  assert.match(out, /🎙 Listen to the recitation/);
  assert.match(out, /Recited by Maḥmūd Khalīl al-Ḥuṣarī \(murattal\) · Qur.an 2:201/);
  // A dua with Arabic but no recording yet says so plainly, instead of falling back to text-to-speech.
  assert.match(out, /No recitation recording for this dua yet\./);
  const settings = render({ ...ctx(initialState(), { ui }), route: { name: 'settings', arg: null } });
  assert.match(settings, /1 recitations are on this device|recitations are on this device/);
});

test('every page renders without a session', () => {
  for (const name of ['', 'map', 'settings', 'prep', 'ihram', 'miqat', 'duas', 'offline', 'info', 'journey', 'about', 'more']) {
    assert.ok(render({ ...ctx(initialState()), route: { name, arg: null } }).length > 300, name);
  }
  assert.match(render({ ...ctx(initialState()), route: { name: 'guide', arg: 'makkah' } }), /Makkah guide/);
});
