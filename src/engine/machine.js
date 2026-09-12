// The live ritual engine: a pure reducer `transition(state, event) -> state`.
// It never reads sensors itself; callers pass `now` and the tracking
// confidence, which keeps it deterministic, testable and fully offline.

import { STAGE, TAWAF_ROUNDS, SAI_LAPS, parseStage, saiDirection, tawafRoundStage, saiLapStage } from './stages.js';

export class RitualError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RitualError';
    this.code = code;
  }
}

export const EV = Object.freeze({
  START: 'START',
  SET_MIQAT: 'SET_MIQAT',
  TOGGLE_CHECK: 'TOGGLE_CHECK',
  NEXT: 'NEXT',
  START_TAWAF: 'START_TAWAF',
  CONFIRM_TAWAF_ROUND: 'CONFIRM_TAWAF_ROUND',
  CORRECT_TAWAF_ROUND: 'CORRECT_TAWAF_ROUND',
  START_SAI: 'START_SAI',
  CONFIRM_SAI_LAP: 'CONFIRM_SAI_LAP',
  CORRECT_SAI_LAP: 'CORRECT_SAI_LAP',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  SET_TRACKING_MODE: 'SET_TRACKING_MODE',
  CONFIRM_HAIR: 'CONFIRM_HAIR',
  RESET: 'RESET',
});

export const IHRAM_CHECKS = Object.freeze(['prepared', 'intention', 'talbiyah']);
export const HAIR_METHODS = Object.freeze({ male: ['shave', 'shorten'], female: ['shorten'] });
export const TRACKING_MODES = Object.freeze(['assisted', 'manual']);

// Stages left with a plain "Continue". Counted stages and hair have their own events.
const SIMPLE_NEXT = {
  [STAGE.MIQAT]: STAGE.IHRAM,
  [STAGE.IHRAM]: STAGE.TALBIYAH,
  [STAGE.TALBIYAH]: STAGE.ENTER_HARAM,
  [STAGE.ENTER_HARAM]: STAGE.TAWAF_READY,
  [STAGE.TAWAF_COMPLETE]: STAGE.TWO_RAKAH,
  [STAGE.TWO_RAKAH]: STAGE.ZAMZAM,
  [STAGE.ZAMZAM]: STAGE.SAFA,
  [STAGE.SAI_COMPLETE]: STAGE.HAIR,
  [STAGE.IHRAM_EXIT]: STAGE.UMRAH_COMPLETE,
};

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

// Tawaf can be recounted until Sa'i starts; Sa'i until the hair ritual is confirmed.
const TAWAF = {
  key: 'tawaf',
  name: 'Tawaf',
  noun: 'round',
  total: TAWAF_ROUNDS,
  items: 'rounds',
  numberField: 'round_number',
  current: 'current_round',
  startedAt: 'current_round_started_at',
  eventField: 'round',
  stageFor: tawafRoundStage,
  completeStage: STAGE.TAWAF_COMPLETE,
  correctable: new Set([...range(TAWAF_ROUNDS).map(tawafRoundStage), STAGE.TAWAF_COMPLETE, STAGE.TWO_RAKAH, STAGE.ZAMZAM, STAGE.SAFA]),
};
const SAI = {
  key: 'sai',
  name: 'Sa’i',
  noun: 'lap',
  total: SAI_LAPS,
  items: 'laps',
  numberField: 'lap_number',
  current: 'current_lap',
  startedAt: 'current_lap_started_at',
  eventField: 'lap',
  stageFor: saiLapStage,
  completeStage: STAGE.SAI_COMPLETE,
  correctable: new Set([...range(SAI_LAPS).map(saiLapStage), STAGE.SAI_COMPLETE, STAGE.HAIR]),
};

export function initialState() {
  return { version: 1, session: null, archive: [] };
}

let fallbackCounter = 0;
export function newId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${(fallbackCounter++).toString(36)}`;
  return `${prefix}_${uuid}`;
}

const fail = (code, message) => {
  throw new RitualError(code, message);
};

export function transition(state, event) {
  if (!event?.type) fail('BAD_EVENT', 'Unknown action.');
  const draft = structuredClone(state);
  apply(draft, event, event.now ?? new Date().toISOString());
  return draft;
}

function apply(st, ev, now) {
  if (ev.type === EV.START) return start(st, ev, now);
  const s = st.session;
  if (!s) fail('NO_SESSION', 'Start your Umrah first.');
  if (ev.type === EV.RESET) {
    log(s, now, ev);
    if (s.status === 'active') s.status = 'abandoned';
    st.archive.push(s);
    st.session = null;
    return;
  }
  if (s.status !== 'active') fail('SESSION_CLOSED', 'This Umrah is already finished.');
  // Buttons carry the stage they were drawn for; a tap from an out-of-date screen is rejected.
  if (ev.expect && ev.expect !== s.current_stage) fail('STALE', 'That button was out of date — the screen has been refreshed.');
  const handler = HANDLERS[ev.type];
  if (!handler) fail('BAD_EVENT', `Unknown action "${ev.type}".`);
  handler(s, ev, now);
  log(s, now, ev);
}

const LOG_FIELDS = ['gender', 'round', 'lap', 'mode', 'method', 'key', 'value', 'confidence', 'routeId'];

function log(s, now, ev) {
  const entry = { at: now, type: ev.type, stage: s.current_stage };
  for (const f of LOG_FIELDS) if (ev[f] !== undefined) entry[f] = ev[f];
  s.log.push(entry);
}

function start(st, ev, now) {
  if (st.session?.status === 'active') fail('SESSION_ACTIVE', 'An Umrah is already in progress.');
  if (!HAIR_METHODS[ev.gender]) fail('GENDER_REQUIRED', 'Choose man or woman so the guidance fits you.');
  if (st.session) st.archive.push(st.session);
  st.session = {
    id: ev.id ?? newId('umrah'),
    user_id: ev.userId ?? 'local',
    started_at: now,
    completed_at: null,
    status: 'active',
    current_stage: STAGE.MIQAT,
    gender: ev.gender,
    language: ev.language ?? 'en',
    miqat: null,
    checks: Object.fromEntries(IHRAM_CHECKS.map((k) => [k, false])),
    paused: false,
    pauses: [],
    tracking_mode: 'manual',
    tawaf: null,
    sai: null,
    two_rakah_at: null,
    zamzam_at: null,
    hair: null,
    ihram_exited_at: null,
    corrections: [],
    log: [],
  };
  log(st.session, now, ev);
}

function requireStage(s, stage) {
  if (s.current_stage !== stage) fail('WRONG_STAGE', 'That action is not available at this step.');
}

const HANDLERS = {
  [EV.SET_MIQAT](s, ev) {
    s.miqat = { route_id: ev.routeId ?? null };
  },

  [EV.TOGGLE_CHECK](s, ev) {
    requireStage(s, STAGE.IHRAM);
    if (!IHRAM_CHECKS.includes(ev.key)) fail('BAD_CHECK', 'Unknown Ihram check.');
    s.checks[ev.key] = ev.value ?? !s.checks[ev.key];
  },

  [EV.NEXT](s, ev, now) {
    const from = s.current_stage;
    const to = SIMPLE_NEXT[from];
    if (!to) fail('NO_NEXT', 'Use the buttons on this screen to continue.');
    if (from === STAGE.IHRAM && !IHRAM_CHECKS.every((k) => s.checks[k])) fail('IHRAM_INCOMPLETE', 'Complete the Ihram check first.');
    if (from === STAGE.TWO_RAKAH) s.two_rakah_at = now;
    if (from === STAGE.ZAMZAM) s.zamzam_at = now;
    if (from === STAGE.IHRAM_EXIT) {
      s.ihram_exited_at = now;
      s.status = 'complete';
      s.completed_at = now;
    }
    s.current_stage = to;
  },

  [EV.START_TAWAF](s, ev, now) {
    requireStage(s, STAGE.TAWAF_READY);
    s.tawaf = { id: newId('tawaf'), umrah_session_id: s.id, started_at: now, completed_at: null, current_round: 1, current_round_started_at: now, status: 'in_progress', rounds: [] };
    s.paused = false;
    s.current_stage = tawafRoundStage(1);
  },
  [EV.CONFIRM_TAWAF_ROUND]: (s, ev, now) => confirmCount(s, ev, now, TAWAF),
  [EV.CORRECT_TAWAF_ROUND]: (s, ev, now) => correctCount(s, ev.round, now, TAWAF),

  [EV.START_SAI](s, ev, now) {
    requireStage(s, STAGE.SAFA);
    s.sai = { id: newId('sai'), umrah_session_id: s.id, started_at: now, completed_at: null, current_lap: 1, current_lap_started_at: now, status: 'in_progress', laps: [] };
    s.paused = false;
    s.current_stage = saiLapStage(1);
  },
  [EV.CONFIRM_SAI_LAP]: (s, ev, now) => confirmCount(s, ev, now, SAI),
  [EV.CORRECT_SAI_LAP]: (s, ev, now) => correctCount(s, ev.lap, now, SAI),

  [EV.PAUSE](s, ev, now) {
    if (parseStage(s.current_stage).kind === 'simple') fail('NOT_PAUSABLE', 'Pause is available during Tawaf and Sa’i.');
    if (s.paused) fail('ALREADY_PAUSED', 'Already paused.');
    s.paused = true;
    s.pauses.push({ stage: s.current_stage, started_at: now, ended_at: null });
  },

  [EV.RESUME](s, ev, now) {
    if (!s.paused) fail('NOT_PAUSED', 'Not paused.');
    s.paused = false;
    const last = s.pauses.at(-1);
    if (last) last.ended_at = now;
  },

  [EV.SET_TRACKING_MODE](s, ev) {
    if (!TRACKING_MODES.includes(ev.mode)) fail('BAD_MODE', 'Unknown tracking mode.');
    s.tracking_mode = ev.mode;
  },

  [EV.CONFIRM_HAIR](s, ev, now) {
    requireStage(s, STAGE.HAIR);
    if (!HAIR_METHODS[s.gender].includes(ev.method)) {
      fail('BAD_HAIR_METHOD', s.gender === 'female' ? 'Women shorten the hair; they do not shave it.' : 'Choose shave or shorten.');
    }
    s.hair = { method: ev.method, at: now };
    s.current_stage = STAGE.IHRAM_EXIT;
  },
};

function makeRecord(cfg, n, fields) {
  const rec = { id: newId(cfg.noun), [cfg.numberField]: n, ...fields };
  if (cfg === SAI) {
    const d = saiDirection(n);
    rec.start_location = d.from;
    rec.end_location = d.to;
  }
  return rec;
}

function confirmCount(s, ev, now, cfg) {
  const p = parseStage(s.current_stage);
  if (p.kind !== cfg.key) fail('WRONG_STAGE', `There is no ${cfg.name} ${cfg.noun} to confirm right now.`);
  if (s.paused) fail('PAUSED', 'Resume before confirming.');
  const requested = ev[cfg.eventField];
  if (requested !== undefined && requested !== p.n) fail('STALE', 'That button was out of date — the screen has been refreshed.');
  const ritual = s[cfg.key];
  ritual[cfg.items].push(
    makeRecord(cfg, p.n, {
      started_at: ritual[cfg.startedAt],
      completed_at: now,
      confirmed: true,
      tracking_confidence: ev.confidence ?? 'manual',
      source: 'confirmed',
    }),
  );
  if (p.n === cfg.total) {
    ritual.status = 'complete';
    ritual.completed_at = now;
    ritual[cfg.startedAt] = null;
    s.current_stage = cfg.completeStage;
  } else {
    ritual[cfg.current] = p.n + 1;
    ritual[cfg.startedAt] = now;
    s.current_stage = cfg.stageFor(p.n + 1);
  }
}

// `n` is the round/lap the pilgrim says they are on NOW. Records below it are
// kept (missing ones are filled in as corrections); records from `n` up are dropped.
function correctCount(s, n, now, cfg) {
  if (!s[cfg.key] || !cfg.correctable.has(s.current_stage)) fail('NOT_CORRECTABLE', `The ${cfg.name} count can’t be changed at this step.`);
  if (!Number.isInteger(n) || n < 1 || n > cfg.total) fail('BAD_COUNT', `Choose a ${cfg.noun} from 1 to ${cfg.total}.`);
  const ritual = s[cfg.key];
  const p = parseStage(s.current_stage);
  const from = p.kind === cfg.key ? p.n : 'complete';
  const kept = ritual[cfg.items].filter((r) => r[cfg.numberField] < n);
  for (let k = 1; k < n; k++) {
    if (!kept.some((r) => r[cfg.numberField] === k)) {
      kept.push(makeRecord(cfg, k, { started_at: null, completed_at: null, confirmed: true, tracking_confidence: 'manual', source: 'correction' }));
    }
  }
  kept.sort((a, b) => a[cfg.numberField] - b[cfg.numberField]);
  ritual[cfg.items] = kept;
  ritual[cfg.current] = n;
  ritual[cfg.startedAt] = now;
  ritual.status = 'in_progress';
  ritual.completed_at = null;
  if (cfg === TAWAF) {
    s.two_rakah_at = null;
    s.zamzam_at = null;
  }
  s.current_stage = cfg.stageFor(n);
  s.corrections.push({ at: now, kind: cfg.key, from, to: n });
}

export function summarize(s) {
  return {
    tawafDone: s.tawaf?.rounds.length ?? 0,
    saiDone: s.sai?.laps.length ?? 0,
    corrections: s.corrections.length,
  };
}

/** Flattens a session into the rows of docs/schema.sql, ready to sync to a backend. */
export function toRecords(s) {
  return {
    umrah_session: {
      id: s.id,
      user_id: s.user_id,
      started_at: s.started_at,
      completed_at: s.completed_at,
      status: s.status,
      current_stage: s.current_stage,
      gender: s.gender,
      language: s.language,
      miqat_route_id: s.miqat?.route_id ?? null,
      two_rakah_at: s.two_rakah_at,
      zamzam_at: s.zamzam_at,
      hair_method: s.hair?.method ?? null,
      ihram_exited_at: s.ihram_exited_at,
    },
    tawaf_session: s.tawaf && {
      id: s.tawaf.id,
      umrah_session_id: s.id,
      started_at: s.tawaf.started_at,
      completed_at: s.tawaf.completed_at,
      current_round: s.tawaf.current_round,
      status: s.tawaf.status,
    },
    tawaf_rounds: (s.tawaf?.rounds ?? []).map((r) => ({
      id: r.id,
      tawaf_session_id: s.tawaf.id,
      round_number: r.round_number,
      started_at: r.started_at,
      completed_at: r.completed_at,
      confirmed: r.confirmed,
      tracking_confidence: r.tracking_confidence,
      source: r.source,
    })),
    sai_session: s.sai && {
      id: s.sai.id,
      umrah_session_id: s.id,
      started_at: s.sai.started_at,
      completed_at: s.sai.completed_at,
      current_lap: s.sai.current_lap,
      status: s.sai.status,
    },
    sai_laps: (s.sai?.laps ?? []).map((l) => ({
      id: l.id,
      sai_session_id: s.sai.id,
      lap_number: l.lap_number,
      start_location: l.start_location,
      end_location: l.end_location,
      started_at: l.started_at,
      completed_at: l.completed_at,
      confirmed: l.confirmed,
      tracking_confidence: l.tracking_confidence,
      source: l.source,
    })),
    ritual_pauses: s.pauses.map((p) => ({ umrah_session_id: s.id, ...p })),
    count_corrections: s.corrections.map((c) => ({ umrah_session_id: s.id, kind: c.kind, from_value: String(c.from), to_value: c.to, at: c.at })),
    ritual_events: s.log.map((e) => ({ umrah_session_id: s.id, ...e })),
  };
}
