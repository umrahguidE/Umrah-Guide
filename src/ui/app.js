// Controller: owns the state, turns taps into engine events, persists after
// every change, and keeps tracking, sensors, voice, recitations, map and wake
// lock in sync.
import { transition, EV, RitualError, toRecords } from '../engine/machine.js';
import { parseStage, saiDirection } from '../engine/stages.js';
import { miqatStatus } from '../engine/miqat.js';
import { calibrateStepLength } from '../engine/motion.js';
import { MIQATS, routeById } from '../data/content.js';
import * as L from '../data/voice-lines.js';
import { setLanguage, languageInfo, getLanguage, t } from '../i18n/index.js';
import { loadState, saveState, loadPrefs, savePrefs, pushUndo, popUndo, undoDepth } from '../store.js';
import { renderApp, createUiState } from './views.js';
import { createTrackingRuntime } from './tracking-runtime.js';
import { requestMotionPermission } from './sensors.js';
import { createVoice, createClipPlayer, PLAYBACK_RATES } from './voice.js';
import { createTrail, localOf } from './map.js';

const root = document.getElementById('app');
const talbiyahAudio = document.getElementById('talbiyah-audio');
const simulate = new URLSearchParams(location.search).has('sim');

let state = loadState();
const prefs = loadPrefs();
const ui = createUiState({ simulate });
setLanguage(prefs.language ?? 'en');
document.documentElement.lang = getLanguage();
document.documentElement.dir = languageInfo().dir;

// Errors that just mean "that tap was a duplicate" — ignore silently.
const QUIET_ERRORS = new Set(['STALE', 'ALREADY_PAUSED', 'NOT_PAUSED']);
const TAP_GUARD_MS = 700;
const QUICK_CONFIRM_MS = 15_000;
const LIVE_RENDER_MS = 700;

const nowIso = () => new Date().toISOString();
const trail = createTrail();

const voice = createVoice({ lang: () => languageInfo().speech });
const clips = createClipPlayer();
voice.enabled = prefs.voice.enabled;
Object.assign(ui.voice, { available: voice.available, enabled: voice.enabled });
ui.stepLengthM = prefs.stepLengthM;
// Playback ticks several times a second (the seek bar); redraw at the same
// calm pace as GPS updates rather than on every tick — and never while a
// finger is actively dragging the seek bar, or the redraw would fight the drag.
let scrubbingSeekBar = false;
clips.onChange((playback) => {
  ui.playback = playback;
  if (!scrubbingSeekBar) renderLive();
});

// Recitations on this device. When the index exists it is the authoritative list.
fetch('./audio/duas/index.json')
  .then((r) => (r.ok ? r.json() : null))
  .then((index) => {
    if (!index?.files) return;
    ui.recitations = index;
    clips.setCatalog(index.files);
    render();
  })
  .catch(() => {});

function route() {
  const [name = '', arg = null] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, arg };
}

function render() {
  pendingLiveRender = false;
  root.innerHTML = String(renderApp({ state, prefs, ui, route: route(), undoAvailable: undoDepth() > 0 }));
}

// GPS and sensor updates arrive many times a second; redraw at a calm pace so
// buttons stay tappable and the screen does not flicker.
let pendingLiveRender = false;
let lastLiveRenderAt = 0;
function renderLive() {
  if (pendingLiveRender || ui.modal) return;
  const wait = Math.max(0, LIVE_RENDER_MS - (Date.now() - lastLiveRenderAt));
  pendingLiveRender = true;
  setTimeout(() => {
    lastLiveRenderAt = Date.now();
    if (pendingLiveRender) render();
  }, wait);
}

// Spoken guidance never talks over a recitation.
const say = (text, options) => {
  if (!text || clips.playingId || !talbiyahAudio.paused) return false;
  return voice.say(text, options);
};

// ───────────────────────── State changes ─────────────────────────

function dispatch(event, { remember = true } = {}) {
  const before = state;
  try {
    state = transition(state, { now: nowIso(), ...event });
  } catch (err) {
    if (!(err instanceof RitualError)) {
      console.error(err);
      ui.error = t('Something went wrong. Your last saved progress is kept.');
    } else if (!QUIET_ERRORS.has(err.code)) {
      ui.error = t(err.message);
    }
    render();
    return false;
  }
  if (remember) pushUndo(before);
  ui.notice = saveState(state) ? null : t('Warning: progress could not be saved on this device (storage full or blocked).');
  ui.error = null;
  ui.justCompleted =
    event.type === EV.CONFIRM_TAWAF_ROUND ? { kind: 'tawaf', n: event.round } : event.type === EV.CONFIRM_SAI_LAP ? { kind: 'sai', n: event.lap } : null;
  if (event.type === EV.START_TAWAF && !talbiyahAudio.paused) talbiyahAudio.pause(); // Talbiyah stops when Tawaf begins.
  const stageChanged = before.session?.current_stage !== state.session?.current_stage;
  if (stageChanged) {
    trail.clear();
    ui.map.trail = [];
    ui.readyChecks = {};
  }
  announce(before, event);
  syncSideEffects();
  render();
  if (stageChanged) window.scrollTo(0, 0);
  return true;
}

function announce(before, event) {
  const s = state.session;
  if (!s) return;
  const stageChanged = before.session?.current_stage !== s.current_stage;
  if (event.type === EV.CONFIRM_TAWAF_ROUND) return void say(L.roundConfirmed(event.round), { interrupt: true, force: true });
  if (event.type === EV.CONFIRM_SAI_LAP) return void say(L.lapConfirmed(event.lap), { interrupt: true, force: true });
  if (event.type === EV.CORRECT_TAWAF_ROUND) return void say(L.corrected('tawaf', event.round), { interrupt: true, force: true });
  if (event.type === EV.CORRECT_SAI_LAP) return void say(L.corrected('sai', event.lap), { interrupt: true, force: true });
  if (event.type === EV.PAUSE) return void say(L.paused(), { interrupt: true });
  if (event.type === EV.RESUME) return void say(L.resumed(), { interrupt: true });
  if (stageChanged) say(L.stageLine(s.current_stage, s), { key: `stage:${s.current_stage}`, interrupt: true });
}

let lastTapAt = 0;
function guarded(fn) {
  const now = Date.now();
  if (now - lastTapAt < TAP_GUARD_MS) return;
  lastTapAt = now;
  fn();
}

function confirmCounted(el, type, field) {
  guarded(() => {
    const s = state.session;
    const ritual = field === 'round' ? s?.tawaf : s?.sai;
    const startedAt = field === 'round' ? ritual?.current_round_started_at : ritual?.current_lap_started_at;
    const n = Number(el.dataset.n);
    const message = field === 'round' ? t('Round {n} started only a few seconds ago. Mark it complete anyway?', { n }) : t('Lap {n} started only a few seconds ago. Mark it complete anyway?', { n });
    if (startedAt && Date.now() - Date.parse(startedAt) < QUICK_CONFIRM_MS && !window.confirm(message)) return;
    const r = ui.reading;
    const assisted = s?.tracking_mode === 'assisted';
    const confidence = assisted && r?.status === 'ok' && r.suggestCompletion ? r.confidence : 'manual';
    if (field === 'lap') learnStepLength(r);
    dispatch({ type, [field]: n, expect: el.dataset.expect, confidence });
  });
}

/** A lap walked with good GPS teaches us the pilgrim's step length for the indoor laps. */
function learnStepLength(reading) {
  if (!reading || reading.mode !== 'gps+steps' || reading.agreement !== 'agree' || reading.progress < 0.9 || !reading.lengthM) return;
  const measured = calibrateStepLength(reading.progress * reading.lengthM, reading.stepsThisLap ?? 0);
  if (!measured) return;
  prefs.stepLengthM = measured;
  ui.stepLengthM = measured;
  savePrefs(prefs);
}

// Starting a ritual is a tap, which is when iOS lets us ask for the compass and step sensors.
async function startCounted(event) {
  if (state.session?.tracking_mode === 'assisted' && !simulate) await requestMotionPermission();
  dispatch(event);
}

// ───────────────────────── Side effects ─────────────────────────

const tracking = createTrackingRuntime({
  simulate,
  isDropped: () => ui.sim.dropped,
  getStepLength: () => prefs.stepLengthM ?? 0.72,
  onSensors(active) {
    ui.sensors = { ...active };
  },
  onReading(reading) {
    const before = ui.reading;
    ui.reading = reading;
    if (reading?.position) ui.map.trail = [...trail.add(reading.position)];
    reactToReading(before, reading);
    renderLive();
  },
});

function reactToReading(before, r) {
  const s = state.session;
  if (!s || !r || r.status !== 'ok') {
    if (s && r && before?.status === 'ok' && (r.status === 'weak' || r.status === 'out_of_area')) say(L.weakSignal(), { key: 'weak', interrupt: true });
    return;
  }
  if (r.suggestCompletion && !before?.suggestCompletion) {
    navigator.vibrate?.(200);
    const p = parseStage(s.current_stage);
    say(p.kind === 'sai' ? L.saiSuggestion(saiDirection(p.n).to) : L.tawafSuggestion(), { key: 'suggest', interrupt: true, force: true });
  }
  if (r.sector && r.sector.id !== before?.sector?.id) say(L.sectorLine(r.sector), { key: `sector:${r.sector.id}` });
  if (r.green === 'inside' && before?.green !== 'inside') {
    navigator.vibrate?.(100);
    say(L.greenMarkers(s.gender), { key: 'green' });
  }
}

let wakeLock = null;
async function syncWakeLock() {
  const s = state.session;
  const want = s?.status === 'active' && parseStage(s.current_stage).kind !== 'simple' && !s.paused && document.visibilityState === 'visible';
  if (want && !wakeLock && 'wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } catch {
      wakeLock = null;
    }
  } else if (!want && wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

function syncSideEffects() {
  tracking.sync(state.session);
  syncWakeLock();
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission was denied.' : 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
    );
  });
}

// ── Live map watch ──
let mapWatchId = null;
function stopMapWatch() {
  if (mapWatchId !== null) navigator.geolocation.clearWatch(mapWatchId);
  mapWatchId = null;
  ui.map.live = false;
  ui.map.position = null;
}
function startMapWatch() {
  if (!('geolocation' in navigator)) {
    ui.map.error = 'Location is not available on this device.';
    return;
  }
  ui.map.error = null;
  ui.map.live = true;
  mapWatchId = navigator.geolocation.watchPosition(
    (p) => {
      const point = localOf({ lat: p.coords.latitude, lng: p.coords.longitude });
      ui.map.position = point;
      ui.map.accuracyM = p.coords.accuracy;
      ui.map.trail = [...trail.add(point)];
      renderLive();
    },
    (err) => {
      ui.map.error = err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.';
      stopMapWatch();
      render();
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
}

// ── Miqat watch ──
let miqatWatchId = null;
function miqatCandidates() {
  const r = routeById(state.session?.miqat?.route_id ?? prefs.miqatRoute);
  return MIQATS.filter((m) => r?.miqats.includes(m.id));
}
function stopMiqatWatch() {
  if (miqatWatchId !== null) navigator.geolocation.clearWatch(miqatWatchId);
  miqatWatchId = null;
  ui.miqatWatching = false;
}
function startMiqatWatch() {
  const candidates = miqatCandidates();
  if (!candidates.length) {
    ui.miqatReading = { error: 'Choose your route first.' };
    return;
  }
  ui.miqatWatching = true;
  miqatWatchId = navigator.geolocation.watchPosition(
    (p) => {
      const before = ui.miqatReading?.status;
      const reading = miqatStatus({ lat: p.coords.latitude, lng: p.coords.longitude }, candidates);
      ui.miqatReading = reading;
      if (reading.status !== before) {
        if (reading.status === 'approaching') {
          navigator.vibrate?.([200, 100, 200]);
          say(L.miqatApproaching(reading.first.kmToBoundary, reading.first.name), { interrupt: true, force: true });
        } else if (reading.status === 'reached') {
          navigator.vibrate?.([400, 150, 400]);
          say(L.miqatReached(reading.first.name), { interrupt: true, force: true });
        }
      }
      render();
    },
    (err) => {
      ui.miqatReading = { error: err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.' };
      stopMiqatWatch();
      render();
    },
    { enableHighAccuracy: false, maximumAge: 30000, timeout: 30000 },
  );
}

async function offlineRequest(type) {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) {
    ui.offline = { error: t('Offline mode needs the app to be opened from a web address (http/https), not as a local file.') };
    render();
    return;
  }
  ui.offline = { ...ui.offline, busy: true, error: null };
  render();
  try {
    const result = await Promise.race([
      navigator.serviceWorker.ready.then(
        (reg) =>
          new Promise((resolve) => {
            const channel = new MessageChannel();
            channel.port1.onmessage = (e) => resolve(e.data);
            reg.active.postMessage({ type }, [channel.port2]);
          }),
      ),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
    ]);
    ui.offline = result.ok ? { groups: result.groups } : { error: `${t('Download failed')}: ${result.error}` };
  } catch (err) {
    ui.offline = { error: `${t('Could not update the offline pack')}: ${err.message}` };
  }
  render();
}

function exportJourney(id) {
  const s = [state.session, ...state.archive].find((x) => x?.id === id);
  if (!s) return;
  const blob = new Blob([JSON.stringify({ exported_at: nowIso(), ...toRecords(s) }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `umrah-journey-${s.started_at.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ───────────────────────── Actions ─────────────────────────

const actions = {
  'set-language'(el) {
    prefs.language = setLanguage(el.dataset.code);
    document.documentElement.lang = prefs.language;
    document.documentElement.dir = languageInfo().dir;
    savePrefs(prefs);
    voice.stop();
    if (location.hash.startsWith('#/language')) location.hash = '#/';
    render();
    const s = state.session;
    say(s ? L.stageLine(s.current_stage, s) : t('Voice guide on.'), { force: true });
  },
  start(form, data) {
    if (dispatch({ type: EV.START, gender: data.get('gender'), language: getLanguage() }) && prefs.miqatRoute) {
      dispatch({ type: EV.SET_MIQAT, routeId: prefs.miqatRoute }, { remember: false });
    }
    location.hash = '#/';
  },
  next: (el) => guarded(() => dispatch({ type: EV.NEXT, expect: el.dataset.expect })),
  check: (el) => dispatch({ type: EV.TOGGLE_CHECK, key: el.dataset.key, value: el.checked }, { remember: false }),
  'ready-check'(el) {
    ui.readyChecks = { ...ui.readyChecks, [el.dataset.key]: el.checked };
    render();
  },
  'start-tawaf': (el) => guarded(() => startCounted({ type: EV.START_TAWAF, expect: el.dataset.expect })),
  'confirm-round': (el) => confirmCounted(el, EV.CONFIRM_TAWAF_ROUND, 'round'),
  'start-sai': (el) => guarded(() => startCounted({ type: EV.START_SAI, expect: el.dataset.expect })),
  'confirm-lap': (el) => confirmCounted(el, EV.CONFIRM_SAI_LAP, 'lap'),
  pause: () => dispatch({ type: EV.PAUSE }),
  resume: () => dispatch({ type: EV.RESUME }),
  'open-correct'(el) {
    ui.modal = { kind: 'correct', ritual: el.dataset.ritual };
    render();
  },
  correct(el) {
    const n = Number(el.dataset.n);
    const ok = dispatch(el.dataset.ritual === 'tawaf' ? { type: EV.CORRECT_TAWAF_ROUND, round: n } : { type: EV.CORRECT_SAI_LAP, lap: n });
    if (ok) {
      ui.modal = null;
      render();
    }
  },
  'close-modal'() {
    ui.modal = null;
    render();
  },
  async tracking(el) {
    const mode = el.dataset.mode;
    if (mode === 'assisted' && !simulate) await requestMotionPermission();
    dispatch({ type: EV.SET_TRACKING_MODE, mode }, { remember: false });
  },
  hair: (form, data) => guarded(() => dispatch({ type: EV.CONFIRM_HAIR, method: data.get('method'), expect: form.dataset.expect })),
  undo() {
    const prev = popUndo();
    if (!prev) return;
    state = prev;
    saveState(state);
    Object.assign(ui, { error: null, modal: null, justCompleted: null });
    syncSideEffects();
    render();
  },
  'end-session'() {
    if (!window.confirm(t('End this Umrah session? It will be kept in your journey history.'))) return;
    if (dispatch({ type: EV.RESET })) location.hash = '#/';
  },
  'new-umrah'() {
    if (dispatch({ type: EV.RESET })) location.hash = '#/';
  },

  // The browser opens and closes <details> itself; remember it so live redraws keep it.
  'toggle-details'(el) {
    const key = el.dataset.key;
    const wasOpen = el.closest('details')?.open;
    if (wasOpen) ui.openDetails.delete(key);
    else ui.openDetails.add(key);
  },

  'miqat-route'(el) {
    prefs.miqatRoute = el.value || null;
    savePrefs(prefs);
    ui.miqatReading = null;
    if (ui.miqatWatching) {
      stopMiqatWatch();
      startMiqatWatch();
    }
    if (state.session?.status === 'active') dispatch({ type: EV.SET_MIQAT, routeId: prefs.miqatRoute }, { remember: false });
    else render();
  },
  'miqat-watch'() {
    if (ui.miqatWatching) stopMiqatWatch();
    else startMiqatWatch();
    render();
  },
  async 'miqat-locate'() {
    ui.miqatReading = { busy: true };
    render();
    try {
      const candidates = miqatCandidates();
      if (!candidates.length) throw new Error('Choose your route first.');
      ui.miqatReading = miqatStatus(await getPosition(), candidates);
      if (ui.miqatReading.status !== 'far') navigator.vibrate?.([200, 100, 200]);
    } catch (err) {
      ui.miqatReading = { error: err.message };
    }
    render();
  },

  'map-live'() {
    if (ui.map.live) stopMapWatch();
    else startMapWatch();
    render();
  },
  'map-clear'() {
    trail.clear();
    ui.map.trail = [];
    render();
  },

  'voice-quick'() {
    voice.enabled = !voice.enabled;
    ui.voice.enabled = voice.enabled;
    prefs.voice.enabled = voice.enabled;
    savePrefs(prefs);
    const s = state.session;
    if (voice.enabled) say(s ? L.stageLine(s.current_stage, s) : t('Voice guide on.'), { force: true, interrupt: true });
    else voice.stop();
    render();
  },
  'voice-toggle'(el) {
    voice.enabled = el.checked;
    ui.voice.enabled = voice.enabled;
    prefs.voice.enabled = voice.enabled;
    savePrefs(prefs);
    if (voice.enabled) say(t('Voice guide on.'), { force: true });
    render();
  },
  'voice-test'() {
    const s = state.session;
    voice.enabled = true;
    ui.voice.enabled = true;
    say(s ? L.stageLine(s.current_stage, s) : t('Voice guide on.'), { force: true, interrupt: true });
    render();
  },
  // Recitations only: a real reciter's recording, never the phone voice.
  async 'play-dua'(el) {
    const id = el.dataset.id;
    if (clips.playingId === id) return clips.stop();
    voice.stop();
    if (!talbiyahAudio.paused) talbiyahAudio.pause();
    if (!(await clips.play(id))) {
      ui.notice = t('This recitation could not be played. Check that the offline pack is downloaded.');
      render();
    }
  },
  // "Play all" for a whole section — every recitation in it, back to back, like a playlist.
  async 'play-all-duas'(el) {
    const ids = el.dataset.ids.split(',');
    if (clips.playingId && ids.includes(clips.playingId)) return clips.stop();
    voice.stop();
    if (!talbiyahAudio.paused) talbiyahAudio.pause();
    if (!(await clips.playAll(ids))) {
      ui.notice = t('These recitations could not be played. Check that the offline pack is downloaded.');
      render();
    }
  },
  'seek-dua'(el) {
    clips.seek(Number(el.value));
  },
  'rate-dua'() {
    const i = PLAYBACK_RATES.indexOf(ui.playback.rate);
    clips.setRate(PLAYBACK_RATES[(i + 1) % PLAYBACK_RATES.length]);
  },
  'reset-step-length'() {
    prefs.stepLengthM = null;
    ui.stepLengthM = null;
    savePrefs(prefs);
    render();
  },

  'prep-toggle'(el) {
    prefs.checklist[el.dataset.id] = el.checked;
    savePrefs(prefs);
    render();
  },
  'save-info'(form, data) {
    for (const [k, v] of data.entries()) prefs.info[k] = String(v).trim();
    ui.notice = savePrefs(prefs) ? t('Saved on this device.') : t('Could not save — device storage is full or blocked.');
    render();
    window.scrollTo(0, 0);
  },
  async 'hotel-here'() {
    try {
      const pos = await getPosition();
      Object.assign(prefs.info, { hotelLat: pos.lat, hotelLng: pos.lng });
      savePrefs(prefs);
      ui.notice = t('Hotel location saved (±{m} m).', { m: Math.round(pos.accuracy) });
      ui.error = null;
    } catch (err) {
      ui.error = t(err.message);
    }
    render();
  },
  'dua-add'(form, data) {
    const text = String(data.get('text') ?? '').trim();
    if (!text) return;
    prefs.personalDuas = [...prefs.personalDuas, { id: Date.now().toString(36), text }];
    savePrefs(prefs);
    render();
  },
  'dua-remove'(el) {
    prefs.personalDuas = prefs.personalDuas.filter((d) => d.id !== el.dataset.id);
    savePrefs(prefs);
    render();
  },
  scroll: (el) => document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: 'smooth' }),

  'audio-toggle'() {
    if (talbiyahAudio.paused) {
      clips.stop();
      voice.stop();
      talbiyahAudio.play().catch(() => ((ui.audio.missing = true), render()));
    } else talbiyahAudio.pause();
  },
  'audio-loop'(el) {
    ui.audio.loop = el.checked;
    talbiyahAudio.loop = el.checked;
    render();
  },
  'offline-download': () => offlineRequest('CACHE_ALL'),
  export: (el) => exportJourney(el.dataset.id),
  'sim-drop'() {
    ui.sim.dropped = !ui.sim.dropped;
    render();
  },
};

// ───────────────────────── Wiring ─────────────────────────

const FORM_FIELDS = new Set(['FORM', 'INPUT', 'SELECT', 'TEXTAREA']);

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || FORM_FIELDS.has(el.tagName)) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.tagName !== 'SUMMARY') e.preventDefault();
  fn(el);
});

root.addEventListener('change', (e) => {
  const el = e.target;
  if (el.tagName === 'FORM' || !el.dataset?.action) return;
  if (el.dataset.action === 'seek-dua') scrubbingSeekBar = false;
  actions[el.dataset.action]?.(el);
});

// While the seek bar is held, keep the label live without letting a redraw yank it from under a finger.
root.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset?.action !== 'seek-dua') return;
  scrubbingSeekBar = true;
  ui.playback = { ...ui.playback, currentTime: Number(el.value) };
});

root.addEventListener('submit', (e) => {
  const form = e.target;
  const fn = actions[form.dataset.action];
  if (!fn) return;
  e.preventDefault();
  fn(form, new FormData(form));
});

window.addEventListener('hashchange', () => {
  Object.assign(ui, { modal: null, notice: null, error: null, justCompleted: null });
  const to = route().name;
  if (to === 'offline') offlineRequest('STATUS');
  if (to !== 'map' && ui.map.live) stopMapWatch();
  render();
  window.scrollTo(0, 0);
});

document.addEventListener('visibilitychange', syncWakeLock);

talbiyahAudio.addEventListener('play', () => ((ui.audio.playing = true), render()));
talbiyahAudio.addEventListener('pause', () => ((ui.audio.playing = false), render()));
talbiyahAudio.addEventListener('error', () => ((ui.audio.missing = true), (ui.audio.playing = false), render()));
if ('mediaSession' in navigator && 'MediaMetadata' in window) {
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Talbiyah', artist: 'Guided Umrah' });
}
globalThis.speechSynthesis?.addEventListener?.('voiceschanged', () => {
  ui.voice.available = voice.available;
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Service worker registration failed', err));
}

syncSideEffects();
render();
if (route().name === 'offline') offlineRequest('STATUS');
