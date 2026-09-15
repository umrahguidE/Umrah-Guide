import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, packFor, setLanguage, getLanguage, t, recordStrings } from '../src/i18n/index.js';
import { transition, initialState, EV, IHRAM_CHECKS } from '../src/engine/machine.js';
import { renderApp, createUiState } from '../src/ui/views.js';
import { defaultPrefs } from '../src/store.js';

const NON_ENGLISH = LANGUAGES.filter((l) => l.code !== 'en');

test('every non-English pack translates every string actually used by the app', () => {
  const used = new Set();
  recordStrings(used);
  try {
    // Drive one full journey while recording every string t() is asked to translate.
    let st = transition(initialState(), { type: EV.START, gender: 'male', now: '2026-01-01T00:00:00Z' });
    const ctx = (state) => ({ state, prefs: { ...defaultPrefs(), language: 'en' }, ui: createUiState(), route: { name: '', arg: null }, undoAvailable: true });
    const step = (e) => (st = transition(st, { now: '2026-01-01T00:00:01Z', ...e }));
    for (const route of ['', 'map', 'settings', 'prep', 'ihram', 'miqat', 'duas', 'offline', 'info', 'journey', 'about', 'more', 'language']) {
      renderApp({ ...ctx(st), route: { name: route, arg: null } });
    }
    renderApp(ctx(st));
    step({ type: EV.NEXT });
    for (const key of IHRAM_CHECKS) step({ type: EV.TOGGLE_CHECK, key, value: true });
    renderApp(ctx(st));
    for (let i = 0; i < 3; i++) {
      step({ type: EV.NEXT });
      renderApp(ctx(st));
    }
    step({ type: EV.START_TAWAF });
    for (let n = 1; n <= 7; n++) {
      renderApp(ctx(st));
      step({ type: EV.CONFIRM_TAWAF_ROUND, round: n });
    }
    for (let i = 0; i < 3; i++) {
      renderApp(ctx(st));
      step({ type: EV.NEXT });
    }
    step({ type: EV.START_SAI });
    for (let n = 1; n <= 7; n++) {
      renderApp(ctx(st));
      step({ type: EV.CONFIRM_SAI_LAP, lap: n });
    }
    renderApp(ctx(st));
    step({ type: EV.NEXT });
    step({ type: EV.CONFIRM_HAIR, method: 'shave' });
    step({ type: EV.NEXT });
    renderApp(ctx(st));
  } finally {
    recordStrings(null);
  }

  assert.ok(used.size > 250, `expected the journey to exercise 250+ distinct strings, saw ${used.size}`);

  for (const { code, name } of NON_ENGLISH) {
    const pack = packFor(code);
    const missing = [...used].filter((s) => !pack[s]);
    assert.deepEqual(missing, [], `${name} (${code}) is missing translations actually used by the app`);
  }
});

test('every translated string keeps the same {placeholders} as its English key', () => {
  for (const { code, name } of NON_ENGLISH) {
    const pack = packFor(code);
    const bad = Object.entries(pack).filter(([key, value]) => {
      const want = [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      const got = [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
      return want !== got;
    });
    assert.deepEqual(bad.map(([k]) => k), [], `${name} (${code}) has placeholder mismatches`);
  }
});

test('t() falls back to English for anything not yet translated, in every language', () => {
  for (const { code } of NON_ENGLISH) {
    setLanguage(code);
    assert.equal(t('This exact sentence is not in any translation pack.'), 'This exact sentence is not in any translation pack.');
  }
  setLanguage('en');
});

test('switching language actually changes rendered text, and Arabic script is never translated', () => {
  const st = transition(initialState(), { type: EV.START, gender: 'male', now: '2026-01-01T00:00:00Z' });
  try {
    for (const { code } of NON_ENGLISH) {
      setLanguage(code);
      const out = String(renderApp({ state: st, prefs: { ...defaultPrefs(), language: code }, ui: createUiState(), route: { name: '', arg: null }, undoAvailable: false }));
      assert.ok(!out.includes('>Start Umrah<'), `${code}: home screen still shows English "Start Umrah"`);
    }
  } finally {
    setLanguage('en');
  }
});

test('Urdu renders right-to-left; every other language renders left-to-right', () => {
  const st = transition(initialState(), { type: EV.START, gender: 'male', now: '2026-01-01T00:00:00Z' });
  try {
    for (const { code, dir } of LANGUAGES) {
      setLanguage(code);
      const out = String(renderApp({ state: st, prefs: { ...defaultPrefs(), language: code }, ui: createUiState(), route: { name: '', arg: null }, undoAvailable: false }));
      assert.match(out, new RegExp(`dir="${dir}"`), `${code} should render dir="${dir}"`);
    }
  } finally {
    setLanguage('en');
  }
});

test('every language reaches the language picker and Umrah-complete screen without leaking raw keys', () => {
  for (const { code } of LANGUAGES) {
    setLanguage(code);
    let st = transition(initialState(), { type: EV.START, gender: 'female', now: '2026-01-01T00:00:00Z' });
    st = transition(st, { type: EV.NEXT, now: '2026-01-01T00:00:01Z' });
    for (const key of IHRAM_CHECKS) st = transition(st, { type: EV.TOGGLE_CHECK, key, value: true, now: '2026-01-01T00:00:01Z' });
    for (let i = 0; i < 3; i++) st = transition(st, { type: EV.NEXT, now: '2026-01-01T00:00:01Z' });
    st = transition(st, { type: EV.START_TAWAF, now: '2026-01-01T00:00:01Z' });
    for (let n = 1; n <= 7; n++) st = transition(st, { type: EV.CONFIRM_TAWAF_ROUND, round: n, now: '2026-01-01T00:00:01Z' });
    for (let i = 0; i < 3; i++) st = transition(st, { type: EV.NEXT, now: '2026-01-01T00:00:01Z' });
    st = transition(st, { type: EV.START_SAI, now: '2026-01-01T00:00:01Z' });
    for (let n = 1; n <= 7; n++) st = transition(st, { type: EV.CONFIRM_SAI_LAP, lap: n, now: '2026-01-01T00:00:01Z' });
    st = transition(st, { type: EV.NEXT, now: '2026-01-01T00:00:01Z' });
    st = transition(st, { type: EV.CONFIRM_HAIR, method: 'shorten', now: '2026-01-01T00:00:01Z' });
    st = transition(st, { type: EV.NEXT, now: '2026-01-01T00:00:01Z' });
    const out = String(renderApp({ state: st, prefs: { ...defaultPrefs(), language: code }, ui: createUiState(), route: { name: '', arg: null }, undoAvailable: false }));
    assert.ok(out.length > 500, code);
    assert.ok(!/undefined|\[object Object\]|NaN/.test(out), `${code} leaks a bad value on the complete screen`);
    assert.match(out, /الحمد لله/, `${code}: Umrah-complete Arabic phrase must never be translated`);
  }
  setLanguage('en');
});
