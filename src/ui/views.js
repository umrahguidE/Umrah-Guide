// Pure view functions: (context) -> markup. No DOM access, so every screen can
// be rendered and tested in Node.
import { html, raw } from './html.js';
import { STAGE, TAWAF_ROUNDS, SAI_LAPS, PLACE_LABEL, parseStage, saiDirection, progressOf, stageTitle, isIhramActive } from '../engine/stages.js';
import { IHRAM_CHECKS, summarize } from '../engine/machine.js';
import { HARAM_GEO } from '../engine/tracking.js';
import { miqatRadiusKm } from '../engine/miqat.js';
import * as C from '../data/content.js';
import { duaCard, progressBar, reviewBadge, roundDots, saiTrack, tawafRing } from './components.js';
import { haramMap } from './map.js';

const G = C.GUIDANCE;

export function createUiState({ simulate = false } = {}) {
  return {
    error: null,
    notice: null,
    modal: null,
    reading: null,
    justCompleted: null,
    miqatReading: null,
    offline: null,
    audio: { playing: false, loop: false, missing: false },
    voice: { available: false, enabled: false, arabic: false, arabicVoice: false, clip: null },
    map: { live: false, open: false, trail: [], position: null, accuracyM: null, error: null },
    miqatWatching: false,
    stepLengthM: null,
    sensors: { compass: false, steps: false },
    sim: { enabled: simulate, dropped: false },
  };
}

const dua = (id) => C.DUAS.find((d) => d.id === id);
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

const STEP_NAMES = ['Miqat', 'Ihram', 'Talbiyah', 'Masjid al-Haram', 'Tawaf', 'Two rak’ahs', 'Zamzam', 'Sa’i', 'Hair', 'Complete'];
const STEP_OF = {
  MIQAT: 1, IHRAM: 2, TALBIYAH: 3, ENTER_HARAM: 4, TAWAF_READY: 5, TAWAF_COMPLETE: 5, TWO_RAKAH: 6,
  ZAMZAM: 7, SAFA: 8, SAI_COMPLETE: 8, HAIR: 9, IHRAM_EXIT: 10, UMRAH_COMPLETE: 10,
};
function stepOf(stage) {
  const p = parseStage(stage);
  if (p.kind === 'tawaf') return 5;
  if (p.kind === 'sai') return 8;
  return STEP_OF[stage];
}

// ───────────────────────── Shell ─────────────────────────

const PAGES = {
  '': guidedPage,
  map: mapPage,
  settings: settingsPage,
  prep: prepPage,
  ihram: ihramPage,
  miqat: miqatPage,
  duas: duasPage,
  offline: offlinePage,
  info: infoPage,
  journey: journeyPage,
  guide: guidePage,
  about: aboutPage,
  more: morePage,
};

export function renderApp(ctx) {
  const page = PAGES[ctx.route.name] ?? guidedPage;
  return html`
    ${topBar(ctx)}
    <a class="review-strip" href="#/about">⚠ ${C.REVIEW_NOTICE}</a>
    <main class="page">
      ${ctx.ui.notice ? html`<p class="alert info" role="status">${ctx.ui.notice}</p>` : ''}
      ${page(ctx)}
    </main>
    ${audioBar(ctx)}
    ${tabBar(ctx)}
    ${ctx.ui.modal ? modal(ctx) : ''}
    ${ctx.ui.sim.enabled ? simPanel(ctx) : ''}`;
}

function topBar(ctx) {
  const s = ctx.state.session;
  return html`<header class="topbar">
    <a class="brand" href="#/"><span aria-hidden="true">🕋</span> Guided Umrah</a>
    ${s?.status === 'active' && isIhramActive(s.current_stage) ? html`<span class="chip ok">🟢 Ihram active</span>` : ''}
    ${ctx.ui.voice.available
      ? html`<button class="chip ok" data-action="voice-quick" aria-pressed="${ctx.ui.voice.enabled}" title="Voice guide">${ctx.ui.voice.enabled ? '🔊' : '🔇'}</button>`
      : ''}
  </header>`;
}

function tabBar(ctx) {
  const tabs = [
    ['', '🕋', 'Umrah'],
    ['map', '🗺', 'Map'],
    ['duas', '🤲', 'Duas'],
    ['journey', '🧭', 'Journey'],
    ['more', '☰', 'More'],
  ];
  return html`<nav class="tabbar" aria-label="Main">
    ${tabs.map(([r, icon, label]) => html`<a href="#/${r}" ${ctx.route.name === r ? raw('aria-current="page"') : ''}><span aria-hidden="true">${icon}</span>${label}</a>`)}
  </nav>`;
}

function audioBar(ctx) {
  const s = ctx.state.session;
  if (!ctx.ui.audio.playing || (ctx.route.name === '' && s?.current_stage === STAGE.TALBIYAH)) return '';
  return html`<div class="audio-bar" role="status">🔊 Talbiyah playing${ctx.ui.audio.loop ? ' (repeating)' : ''}
    <button class="btn small" data-action="audio-toggle">Pause</button></div>`;
}

function simPanel(ctx) {
  return html`<div class="sim-panel">🛰 Simulated GPS
    <button class="btn small" data-action="sim-drop">${ctx.ui.sim.dropped ? 'Restore signal' : 'Drop signal'}</button></div>`;
}

// ───────────────────────── Shared bits ─────────────────────────

const errorBox = (ctx) => (ctx.ui.error ? html`<p class="alert error" role="alert">${ctx.ui.error}</p>` : '');
const pointsList = (items) => (items?.length ? html`<ul class="points">${items.map((p) => html`<li>${p}</li>`)}</ul>` : '');
const genderPoints = (g, gender) => (gender === 'male' ? g.men : g.women) ?? [];
const guidance = (g, gender) => pointsList([...(g.points ?? []), ...genderPoints(g, gender)]);

function stageHeader(stage, title, lead) {
  return html`<header class="stage-head">
    <p class="eyebrow">Step ${stepOf(stage)} of ${STEP_NAMES.length} · ${STEP_NAMES[stepOf(stage) - 1]}</p>
    <h1>${title}</h1>
    ${lead ? html`<p class="lead">${lead}</p>` : ''}
  </header>`;
}

function pageHeader(title, lead) {
  return html`<header class="stage-head"><h1>${title}</h1>${lead ? html`<p class="lead">${lead}</p>` : ''}</header>`;
}

const continueBtn = (s, label) => html`<button class="btn primary big" data-action="next" data-expect="${s.current_stage}">${label}</button>`;

function tile(href, icon, title, sub) {
  return html`<a class="tile" href="${href}"><span class="tile-icon" aria-hidden="true">${icon}</span><b>${title}</b>${sub ? html`<small>${sub}</small>` : ''}</a>`;
}

// ───────────────────────── Guided Umrah Mode ─────────────────────────

function guidedPage(ctx) {
  const s = ctx.state.session;
  if (!s) return homePage(ctx);
  return html`
    ${s.status === 'active' ? statusCard(s, ctx) : ''}
    ${errorBox(ctx)}
    ${justDone(ctx)}
    ${stageBody(s, ctx)}`;
}

function statusCard(s, ctx) {
  const p = parseStage(s.current_stage);
  const pct = progressOf(s.current_stage);
  const d = p.kind === 'sai' ? saiDirection(p.n) : null;
  return html`<section class="status-card" aria-label="My Umrah progress">
    <div class="status-row"><span class="eyebrow">My Umrah</span>
      ${ctx.undoAvailable ? html`<button class="link" data-action="undo">↶ Undo last step</button>` : ''}</div>
    <div class="status-overall">${progressBar(pct, 'Overall Umrah progress')}<b>${Math.round(pct * 100)}%</b></div>
    <p class="status-current"><span class="muted">Current</span> <b>${stageTitle(s.current_stage)}</b>
      ${d ? html`<span class="status-dir">${PLACE_LABEL[d.from]} → ${PLACE_LABEL[d.to]}</span>` : ''}
      ${s.paused ? html`<span class="chip warn">Paused</span>` : ''}</p>
  </section>`;
}

function justDone(ctx) {
  const j = ctx.ui.justCompleted;
  if (!j) return '';
  if (j.kind === 'tawaf') {
    return html`<p class="alert success" role="status">✓ Round ${j.n} completed${j.n === TAWAF_ROUNDS ? ' — Tawaf finished' : ''}</p>`;
  }
  const d = saiDirection(j.n);
  const next = j.n < SAI_LAPS ? saiDirection(j.n + 1) : null;
  return html`<p class="alert success" role="status">✓ ${PLACE_LABEL[d.to]} reached — Lap ${j.n} complete${
    next ? html`. Next: <b>${PLACE_LABEL[next.from]} → ${PLACE_LABEL[next.to]}</b>` : ''
  }</p>`;
}

function stageBody(s, ctx) {
  const p = parseStage(s.current_stage);
  if (p.kind === 'tawaf') return tawafRoundView(s, p.n, ctx);
  if (p.kind === 'sai') return saiLapView(s, p.n, ctx);
  const view = SIMPLE_VIEWS[s.current_stage];
  return view ? view(s, ctx) : html`<p class="alert error">Unknown step: ${s.current_stage}</p>`;
}

function homePage(ctx) {
  const prepDone = C.PREP_CHECKLIST.filter((i) => ctx.prefs.checklist[i.id]).length;
  return html`
    <section class="hero">
      <p class="eyebrow">Guided Umrah Mode</p>
      <h1>From the Miqat to the final haircut — one step at a time.</h1>
      <p>Where am I? What am I doing? Which round? What comes next? Am I finished? The guide answers as you go, and works without internet.</p>
      ${errorBox(ctx)}
      <form class="start-form" data-action="start">
        <fieldset class="segmented">
          <legend>Show guidance for</legend>
          <label><input type="radio" name="gender" value="male" required><span>Man</span></label>
          <label><input type="radio" name="gender" value="female"><span>Woman</span></label>
        </fieldset>
        <button class="btn primary big" type="submit">Start Umrah</button>
      </form>
    </section>
    <section class="tiles">
      ${tile('#/prep', '🧳', 'Preparation', `${prepDone} / ${C.PREP_CHECKLIST.length} ready`)}
      ${tile('#/ihram', '🤍', 'Understand Ihram', 'Clothing, intention, restrictions')}
      ${tile('#/miqat', '📍', 'Miqat guide', 'Based on your route')}
      ${tile('#/offline', '⬇️', 'Offline pack', 'Download before the Haram')}
      ${tile('#/info', '🆘', 'My info & emergency', 'Hotel, group, contacts')}
      ${tile('#/duas', '🤲', 'Duas', 'Arabic · transliteration · meaning')}
    </section>
    ${ctx.state.archive.length ? html`<p class="center"><a href="#/journey">Past journeys (${ctx.state.archive.length})</a></p>` : ''}`;
}

function miqatPanel(ctx, routeId) {
  const route = C.routeById(routeId);
  const miqats = route ? C.MIQATS.filter((m) => route.miqats.includes(m.id)) : [];
  return html`<section class="card">
    <label class="field"><span>Where are you travelling from?</span>
      <select data-action="miqat-route">
        <option value="">Choose your route…</option>
        ${C.ROUTE_GROUPS.map((g) => html`<optgroup label="${g.label}">
          ${C.ROUTES.filter((r) => r.group === g.id).map((r) => html`<option value="${r.id}" ${r.id === routeId ? 'selected' : ''}>${r.label}</option>`)}
        </optgroup>`)}
      </select>
    </label>
    ${route
      ? html`<p class="lead">${route.note}</p>
        ${miqats.map((m) => html`<div class="miqat"><b>${m.name}</b> <span class="muted">— ${m.modern}</span><small>${m.forWho} About ${Math.round(miqatRadiusKm(m))} km from Makkah in a straight line.</small></div>`)}
        ${pointsList(route.extra)}
        <details class="card inner" ${route.mode === 'inside' ? raw('open') : ''}><summary>What to do, step by step</summary>${pointsList(C.ROUTE_STEPS[route.mode] ?? [])}</details>
        ${route.miqats.length ? miqatWatchControls(ctx) : ''}`
      : html`<p class="muted">Flights are listed by country, roads and the train by where you set out from.</p>`}
    <p>${reviewBadge(C.CONTENT_META.review)}</p>
  </section>`;
}

function miqatWatchControls(ctx) {
  const on = ctx.ui.miqatWatching;
  return html`<div class="row">
    <button class="btn ${on ? 'primary' : ''}" data-action="miqat-watch">${on ? '⏹ Stop watching' : '🔔 Watch for my Miqat'}</button>
    <button class="btn" data-action="miqat-locate">📍 Check once</button>
  </div>
  ${on ? html`<p class="muted"><small>Watching. Keep the app open or in the background — it will vibrate, speak and warn you as the Miqat line approaches.</small></p>` : ''}
  ${miqatReadingView(ctx.ui.miqatReading)}`;
}

function miqatReadingView(r) {
  if (!r) return '';
  if (r.busy) return html`<p class="muted">Finding your location…</p>`;
  if (r.error) return html`<p class="alert warn">${r.error}</p>`;
  const label = {
    far: 'Not near the Miqat yet',
    approaching: 'Approaching the Miqat — get ready now',
    reached: 'You have reached or passed the Miqat boundary',
  }[r.status];
  const km = Math.round(r.first.kmToBoundary);
  return html`<div class="alert ${r.status === 'far' ? 'info' : 'warn'}" role="status">
    <b>${label}</b><br>
    First boundary on your route: ${r.first.name} — ${km > 0 ? `about ${km} km to go` : 'crossed'}.<br>
    <small>Approximate: compares your straight-line distance from Makkah with the Miqat’s. The crew announcement or your group leader takes priority.</small>
  </div>`;
}

function trackingToggle(s) {
  const on = s.tracking_mode === 'assisted';
  return html`<section class="card tracking-toggle">
    <div><b>Location assistance: ${on ? 'On' : 'Off'}</b>
      <small>Location only <em>suggests</em> when a round or lap may be finished — you always confirm it yourself. GPS is often weak inside the Haram.</small></div>
    <button class="btn small" data-action="tracking" data-mode="${on ? 'manual' : 'assisted'}">${on ? 'Turn off' : 'Turn on'}</button>
  </section>`;
}

// A round only counts once these corners have been passed, in Tawaf order.
function cornerChecks(checkpoints, nearStart) {
  const items = [
    ['iraqi', 'ʿIrāqī'],
    ['shami', 'Shāmī'],
    ['yemeni', 'Yemeni'],
  ];
  const all = items.every(([k]) => checkpoints[k]);
  return html`<ol class="corners" aria-label="Corners passed this round">
    ${items.map(([key, label]) => html`<li class="${checkpoints[key] ? 'done' : ''}">${checkpoints[key] ? '✓' : '○'} ${label}</li>`)}
    <li class="${all && nearStart ? 'done' : ''}">${all && nearStart ? '✓' : '○'} Black Stone</li>
  </ol>`;
}

function sectorCard(sector) {
  if (!sector) return '';
  return html`<section class="card sector"><b>Now beside: ${sector.label}</b>${sector.tip ? html`<p>${sector.tip}</p>` : ''}</section>`;
}

function mapCard(ctx, { pilgrim = null, accuracyM = null, saiFromSafa = null, focus = null }) {
  return html`<details class="card map-card" ${ctx.ui.map.open ? raw('open') : ''}>
    <summary data-action="toggle-map">🗺 Map — where I am</summary>
    ${haramMap({ pilgrim, accuracyM, trail: ctx.ui.map.trail, saiFromSafa, focus })}
    <p class="muted"><small>Schematic: positions are approximate until the site survey.</small></p>
  </details>`;
}

const MODE_LABEL = {
  'gps+compass': 'GPS + compass',
  'gps+steps': 'GPS + steps',
  gps: 'GPS',
  compass: 'Compass only — GPS is weak here',
  steps: 'Steps only — GPS is weak here',
};
const CONFIDENCE_LABEL = { high: 'high confidence', medium: 'medium confidence', low: 'low confidence — check it yourself' };

// Which signals are counting right now: GPS, body turning (compass), and steps.
function sourceChips(r) {
  const steps = r.stepsThisRound ?? r.stepsThisLap ?? null;
  const on = (yes) => (yes ? 'on' : '');
  return html`<div class="sources">
    <span class="chip ${on(r.mode?.includes('gps'))}">📡 GPS</span>
    ${r.headingProgress === undefined ? '' : html`<span class="chip ${on(r.mode?.includes('compass'))}">🧭 Turning</span>`}
    <span class="chip ${on(r.mode?.includes('steps'))}">👣 ${steps ?? 0} steps</span>
    ${r.confidence ? html`<span class="chip ${r.confidence === 'low' ? 'warn' : ''}">${CONFIDENCE_LABEL[r.confidence]}</span>` : ''}
  </div>`;
}

// Shown on every round/lap screen so assistance can be switched on or off mid-ritual.
function trackingStatus(s, r, lastConfirmed) {
  if (s.tracking_mode !== 'assisted') {
    return html`<p class="tracking-line">📍 Location assistance off · <button class="link" data-action="tracking" data-mode="assisted">Turn on</button></p>`;
  }
  const off = html` · <button class="link" data-action="tracking" data-mode="manual">Turn off</button>`;
  if (!r || r.status === 'waiting') return html`<p class="tracking-line">📡 Waiting for a location fix…${off}</p>`;
  if (r.status === 'ok') return html`<div class="tracking-box"><p class="tracking-line ok">📡 ${MODE_LABEL[r.mode] ?? 'Tracking'}${off}</p>${sourceChips(r)}</div>`;
  const why = {
    weak: 'Tracking signal weak',
    denied: 'Location permission denied',
    unavailable: 'Location unavailable',
    unsupported: 'Location is not supported on this device',
    out_of_area: 'You seem to be outside the tracking area',
  }[r.status] ?? 'Tracking unavailable';
  return html`<div class="alert warn" role="alert">
    <b>⚠ ${why}</b>
    <p>We cannot reliably determine your current position.</p>
    <p>Your last confirmed progress:<br><b>${lastConfirmed}</b></p>
    <p>Please count yourself and confirm manually.</p>
    <button class="btn" data-action="tracking" data-mode="manual">Continue manually</button>
  </div>`;
}

function pausedCard(ritual, label) {
  return html`<section class="card paused" role="status">
    <p class="eyebrow">Paused</p>
    <h2>${label}</h2>
    <p>Tracking paused. Take your time — water, rest, prayer, family.</p>
    <p class="muted">${G.PAUSE}</p>
    <div class="row">
      <button class="btn primary" data-action="resume">▶ Resume</button>
      <button class="btn" data-action="open-correct" data-ritual="${ritual}">Correct ${ritual === 'tawaf' ? 'round' : 'lap'}</button>
    </div>
  </section>`;
}

function countList(records, field, noun, withDirection = false) {
  return html`<ul class="count-list">
    ${records.map((r) => {
      const n = r[field];
      const dir = withDirection ? ` · ${PLACE_LABEL[r.start_location]} → ${PLACE_LABEL[r.end_location]}` : '';
      return html`<li><span>✓ ${noun} ${n}${dir}</span><small>${r.source === 'correction' ? 'set by correction' : fmtTime(r.completed_at)}</small></li>`;
    })}
  </ul>`;
}

function tawafRoundView(s, n, ctx) {
  const done = s.tawaf.rounds.length;
  const r = ctx.ui.reading;
  const assisted = s.tracking_mode === 'assisted';
  const fix = assisted && r?.status === 'ok';
  const final = n === TAWAF_ROUNDS;
  const lastConfirmed = `Tawaf — ${done} of ${TAWAF_ROUNDS} rounds confirmed (you are on Round ${n})`;
  return html`
    <section class="counter ${final ? 'final' : ''}">
      <p class="eyebrow">Tawaf${final ? ' · final round' : ''}</p>
      <h1 class="count">Round <b>${n}</b> <span>/ ${TAWAF_ROUNDS}</span></h1>
      ${roundDots(done, n, TAWAF_ROUNDS)}
    </section>
    ${s.paused
      ? pausedCard('tawaf', `Tawaf Round ${n} / ${TAWAF_ROUNDS}`)
      : html`
        ${tawafRing({ progress: fix ? r.progress : null, startBearing: HARAM_GEO.blackStoneBearingDeg })}
        <p class="left-hint">🕋 Kaaba is on your <b>LEFT</b></p>
        ${fix && r.checkpoints ? cornerChecks(r.checkpoints, r.nearStart) : ''}
        ${sectorCard(fix ? r.sector : null)}
        ${trackingStatus(s, r, lastConfirmed)}
        ${mapCard(ctx, { pilgrim: r?.position ?? null, accuracyM: r?.position?.accuracyM ?? null, focus: 'tawaf' })}
        ${fix && r.suggestCompletion
          ? html`<div class="alert suggest" role="status"><b>Possible round completion</b><br>You appear to have reached the starting point. Confirm only if you have completed Round ${n}.</div>`
          : ''}
        <button class="btn primary big ${final ? 'final' : ''}" data-action="confirm-round" data-n="${n}" data-expect="${s.current_stage}">Confirm Round ${n} complete</button>
        <p class="hint">Tap when you are back at the Black Stone line (green light on the wall).</p>`}
    <div class="row actions">
      <a class="btn" href="#/duas">🤲 Duas</a>
      ${s.paused ? '' : html`<button class="btn" data-action="pause">⏸ Pause</button>`}
      ${s.paused ? '' : html`<button class="btn" data-action="open-correct" data-ritual="tawaf">Wrong count?</button>`}
    </div>
    ${s.gender === 'male' && n <= 3 ? html`<p class="alert info">${G.TAWAF_ROUND.ramal}</p>` : ''}
    ${pointsList(G.TAWAF_ROUND.points)}
    <details class="card"><summary>Words at the Black Stone and Yemeni Corner</summary>
      ${duaCard(dua('black-stone'))}${duaCard(dua('yemeni-corner'))}
    </details>`;
}

function greenMarkerCard(gender, green) {
  const men = gender === 'male';
  const heads = {
    inside: men ? '🟢 Jogging zone — jog if you are able' : '🟢 Green markers — keep walking normally',
    ahead: '🟢 Green markers ahead',
    passed: '✓ Green markers passed',
  };
  return html`<section class="card green ${green === 'inside' ? 'active' : ''}">
    <b>${heads[green] ?? '🟢 Green markers'}</b>
    <p>${men ? G.SAI_LAP.men[0] : G.SAI_LAP.women[0]}</p>
    ${green === 'inside' || green === 'ahead' ? html`<small>You may say: “Rabbighfir warḥam…” (see Duas) — or any dua.</small>` : ''}
  </section>`;
}

function saiLapView(s, n, ctx) {
  const d = saiDirection(n);
  const done = s.sai.laps.length;
  const r = ctx.ui.reading;
  const assisted = s.tracking_mode === 'assisted';
  const fix = assisted && r?.status === 'ok';
  const final = n === SAI_LAPS;
  const to = PLACE_LABEL[d.to];
  return html`
    <section class="counter ${final ? 'final' : ''}">
      <p class="eyebrow">Sa’i${final ? ' · final lap' : ''}</p>
      <h1 class="count">Lap <b>${n}</b> <span>/ ${SAI_LAPS}</span></h1>
      ${roundDots(done, n, SAI_LAPS)}
      <p class="direction">${PLACE_LABEL[d.from]} <span aria-hidden="true">→</span> <b>${to}</b></p>
    </section>
    ${s.paused
      ? pausedCard('sai', `Sa’i Lap ${n} / ${SAI_LAPS}`)
      : html`
        <div class="sai-layout">
          ${saiTrack({ direction: d.key, fromSafa: fix ? r.fromSafa : null, greenZone: HARAM_GEO.greenZone })}
          ${greenMarkerCard(s.gender, fix ? r.green : null)}
        </div>
        ${trackingStatus(s, r, `Sa’i — ${done} of ${SAI_LAPS} laps confirmed (you are on Lap ${n})`)}
        ${mapCard(ctx, { saiFromSafa: fix ? r.fromSafa : null, focus: 'sai' })}
        ${fix && r.suggestCompletion
          ? html`<div class="alert suggest" role="status"><b>${to} reached?</b><br>${final ? 'You are approaching the final destination.' : `You appear to be at ${to}.`} Confirm only when you have arrived.</div>`
          : ''}
        <button class="btn primary big ${final ? 'final' : ''}" data-action="confirm-lap" data-n="${n}" data-expect="${s.current_stage}">Confirm arrival at ${to.toUpperCase()}</button>
        <p class="hint">On reaching ${to}: face the Kaaba, raise your hands, and repeat the dhikr and dua as at Safa.</p>`}
    <div class="row actions">
      <a class="btn" href="#/duas">🤲 Duas</a>
      ${s.paused ? '' : html`<button class="btn" data-action="pause">⏸ Pause</button>`}
      ${s.paused ? '' : html`<button class="btn" data-action="open-correct" data-ritual="sai">Wrong count?</button>`}
    </div>
    ${pointsList(G.SAI_LAP.points)}
    <details class="card"><summary>Words on Safa and Marwah</summary>${duaCard(dua('safa-marwah-dhikr'))}</details>`;
}

const SIMPLE_VIEWS = {
  [STAGE.MIQAT]: (s, ctx) => html`
    ${stageHeader(s.current_stage, 'Approaching the Miqat', G.MIQAT.lead)}
    ${miqatPanel(ctx, s.miqat?.route_id ?? ctx.prefs.miqatRoute)}
    ${pointsList(G.MIQAT.points)}
    ${continueBtn(s, 'I’m at the Miqat — enter Ihram')}
    <p class="hint">Already in Ihram? Continue — you will confirm it on the next screen.</p>`,

  [STAGE.IHRAM]: (s) => {
    const ready = IHRAM_CHECKS.every((k) => s.checks[k]);
    return html`
      ${stageHeader(s.current_stage, 'Ihram check', G.IHRAM.lead)}
      <section class="card checks">
        ${IHRAM_CHECKS.map((k) => html`<label class="check">
          <input type="checkbox" data-action="check" data-key="${k}" ${s.checks[k] ? 'checked' : ''}>
          <span><b>${G.IHRAM.checks[k].label}</b><small>${G.IHRAM.checks[k].help}</small></span>
        </label>`)}
      </section>
      ${duaCard(dua('intention'))}
      <details class="card"><summary>Optional condition, if you fear being prevented</summary>${duaCard(dua('ishtirat'))}</details>
      <p><a href="#/ihram">Read the Ihram restrictions →</a></p>
      <button class="btn primary big" data-action="next" data-expect="${s.current_stage}" ${ready ? '' : 'disabled'}>Continue</button>
      ${ready ? '' : html`<p class="hint">Tick all three to continue.</p>`}`;
  },

  [STAGE.TALBIYAH]: (s, ctx) => html`
    ${stageHeader(s.current_stage, 'Talbiyah', G.TALBIYAH.lead)}
    ${duaCard(dua('talbiyah'))}
    <section class="card audio-controls">
      <button class="btn" data-action="audio-toggle">${ctx.ui.audio.playing ? '⏸ Pause' : '▶ Play audio'}</button>
      <label class="check inline"><input type="checkbox" data-action="audio-loop" ${ctx.ui.audio.loop ? 'checked' : ''}>
        <span>Background mode — keep repeating while I use the app</span></label>
      ${ctx.ui.audio.missing ? html`<p class="alert warn">Recitation audio is not bundled in this build yet. Recite from the text above.</p>` : ''}
    </section>
    ${guidance(G.TALBIYAH, s.gender)}
    ${continueBtn(s, 'I’ve arrived at Masjid al-Haram')}`,

  [STAGE.ENTER_HARAM]: (s) => html`
    ${stageHeader(s.current_stage, 'Makkah — Masjid al-Haram', G.ENTER_HARAM.lead)}
    <p class="next-up">Next: <b>Tawaf</b></p>
    ${pointsList(G.ENTER_HARAM.points)}
    ${duaCard(dua('enter-mosque'))}
    ${continueBtn(s, 'Go to the Tawaf starting point')}`,

  [STAGE.TAWAF_READY]: (s) => html`
    ${stageHeader(s.current_stage, 'Tawaf — starting point', G.TAWAF_READY.lead)}
    ${tawafRing({ startBearing: HARAM_GEO.blackStoneBearingDeg })}
    <p class="left-hint">🕋 Kaaba on your <b>LEFT</b> · start at the Black Stone line</p>
    ${guidance(G.TAWAF_READY, s.gender)}
    ${duaCard(dua('black-stone'))}
    ${trackingToggle(s)}
    <button class="btn primary big" data-action="start-tawaf" data-expect="${s.current_stage}">Start Round 1</button>`,

  [STAGE.TAWAF_COMPLETE]: (s) => html`
    <section class="done-card">
      <p class="eyebrow">Tawaf</p>
      <h1>${summarize(s).tawafDone} / ${TAWAF_ROUNDS} complete ✅</h1>
      ${countList(s.tawaf.rounds, 'round_number', 'Round')}
      <p class="muted">Started ${fmtTime(s.tawaf.started_at)} · Completed ${fmtTime(s.tawaf.completed_at)}</p>
    </section>
    ${pointsList(genderPoints(G.TAWAF_COMPLETE, s.gender))}
    <p class="next-up">Next recommended step: <b>Pray two rak’ahs</b></p>
    ${continueBtn(s, 'Continue')}
    <button class="btn ghost" data-action="open-correct" data-ritual="tawaf">Wrong count?</button>`,

  [STAGE.TWO_RAKAH]: (s) => html`
    ${stageHeader(s.current_stage, 'Two rak’ahs', G.TWO_RAKAH.lead)}
    ${pointsList(G.TWO_RAKAH.points)}
    ${duaCard(dua('maqam'))}
    ${continueBtn(s, 'I’ve prayed — continue')}
    <button class="btn ghost" data-action="open-correct" data-ritual="tawaf">Recount Tawaf</button>`,

  [STAGE.ZAMZAM]: (s) => html`
    ${stageHeader(s.current_stage, 'Zamzam', G.ZAMZAM.lead)}
    ${pointsList(G.ZAMZAM.points)}
    ${duaCard(dua('zamzam'))}
    ${continueBtn(s, 'Continue to Sa’i')}`,

  [STAGE.SAFA]: (s) => html`
    ${stageHeader(s.current_stage, 'Sa’i — starting point: SAFA 🟢', G.SAFA.lead)}
    ${pointsList(G.SAFA.points)}
    ${duaCard(dua('safa-verse'))}
    ${duaCard(dua('safa-marwah-dhikr'))}
    ${trackingToggle(s)}
    <button class="btn primary big" data-action="start-sai" data-expect="${s.current_stage}">Start Sa’i — Lap 1: Safa → Marwah</button>`,

  [STAGE.SAI_COMPLETE]: (s) => html`
    <section class="done-card">
      <p class="eyebrow">Sa’i</p>
      <h1>${summarize(s).saiDone} / ${SAI_LAPS} complete ✅</h1>
      ${countList(s.sai.laps, 'lap_number', 'Lap', true)}
      <p><b>END: MARWAH</b></p>
      <p class="muted">Started ${fmtTime(s.sai.started_at)} · Completed ${fmtTime(s.sai.completed_at)}</p>
    </section>
    <p class="next-up">${G.SAI_COMPLETE.lead}</p>
    ${continueBtn(s, 'Continue to the final step')}
    <button class="btn ghost" data-action="open-correct" data-ritual="sai">Wrong count?</button>`,

  [STAGE.HAIR]: (s) => {
    const opts = C.HAIR_OPTIONS[s.gender];
    return html`
      ${stageHeader(s.current_stage, 'Hair — final Umrah step', G.HAIR.lead)}
      <form class="card" data-action="hair" data-expect="${s.current_stage}">
        <fieldset><legend>${s.gender === 'male' ? 'Men' : 'Women'}</legend>
          ${opts.map((o) => html`<label class="check">
            <input type="radio" name="method" value="${o.value}" ${opts.length === 1 ? 'checked' : ''} required>
            <span><b>${o.label}</b><small>${o.note}</small></span></label>`)}
        </fieldset>
        ${s.gender === 'male' ? pointsList(G.HAIR.points) : ''}
        <button class="btn primary big" type="submit">Confirm — hair done</button>
      </form>
      <button class="btn ghost" data-action="open-correct" data-ritual="sai">Recount Sa’i</button>`;
  },

  [STAGE.IHRAM_EXIT]: (s) => html`
    <section class="done-card">
      <p class="eyebrow">Umrah status</p>
      <dl class="summary">
        <dt>Ihram restrictions</dt><dd><b>ENDED</b></dd>
        <dt>Tawaf</dt><dd>✓ ${summarize(s).tawafDone}/${TAWAF_ROUNDS}</dd>
        <dt>Sa’i</dt><dd>✓ ${summarize(s).saiDone}/${SAI_LAPS}</dd>
        <dt>Hair</dt><dd>✓ ${s.hair?.method === 'shave' ? 'Shaved' : 'Shortened'}</dd>
      </dl>
    </section>
    <p class="lead">${G.IHRAM_EXIT.lead}</p>
    ${continueBtn(s, 'Finish — mark my Umrah complete')}`,

  [STAGE.UMRAH_COMPLETE]: (s) => {
    const sum = summarize(s);
    return html`<section class="complete">
      <p class="arabic big" lang="ar" dir="rtl">الحمد لله</p>
      <h1>Umrah complete</h1>
      <dl class="summary">
        <dt>Ihram</dt><dd>✓</dd>
        <dt>Talbiyah</dt><dd>✓</dd>
        <dt>Tawaf</dt><dd>${sum.tawafDone} / ${TAWAF_ROUNDS} ✓</dd>
        <dt>2 Rak’ahs</dt><dd>${s.two_rakah_at ? '✓' : '—'}</dd>
        <dt>Zamzam</dt><dd>${s.zamzam_at ? '✓' : '—'}</dd>
        <dt>Sa’i</dt><dd>${sum.saiDone} / ${SAI_LAPS} ✓</dd>
        <dt>Hair</dt><dd>✓</dd>
      </dl>
      <p class="muted">Started: ${fmtDateTime(s.started_at)}<br>Completed: ${fmtDateTime(s.completed_at)}</p>
      <p>Taqabbal Allāhu minnā wa minkum — may Allah accept it from us and from you.</p>
      <div class="grid-buttons">
        <a class="btn" href="#/journey">View journey</a>
        <a class="btn" href="#/duas">View duas</a>
        <a class="btn" href="#/guide/makkah">Makkah guide</a>
        <a class="btn" href="#/guide/madinah">Madinah guide</a>
      </div>
      <button class="btn ghost" data-action="new-umrah">Start another Umrah</button>
    </section>`;
  },
};

// ───────────────────────── Correction modal ─────────────────────────

function modal(ctx) {
  const { ritual } = ctx.ui.modal;
  const s = ctx.state.session;
  if (!s) return '';
  const tawaf = ritual === 'tawaf';
  const total = tawaf ? TAWAF_ROUNDS : SAI_LAPS;
  const noun = tawaf ? 'round' : 'lap';
  const p = parseStage(s.current_stage);
  const current = p.kind === ritual ? p.n : null;
  return html`<div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="correct-title">
      <h2 id="correct-title">Wrong count?</h2>
      <p>Current: <b>${current ? `${tawaf ? 'Round' : 'Lap'} ${current} / ${total}` : `${tawaf ? 'Tawaf' : 'Sa’i'} complete`}</b></p>
      <p>Select the ${noun} you are on <b>now</b>:</p>
      <div class="picker">
        ${range(total).map((n) => html`<button class="btn ${n === current ? 'current' : ''}" data-action="correct" data-ritual="${ritual}" data-n="${n}">${n}${
          tawaf ? '' : html`<small>${PLACE_LABEL[saiDirection(n).from][0]}→${PLACE_LABEL[saiDirection(n).to][0]}</small>`
        }</button>`)}
      </div>
      ${tawaf ? '' : html`<p class="muted">Odd laps go Safa → Marwah; even laps go Marwah → Safa.</p>`}
      <p class="alert info">This app’s count is only a record to help you. <b>Your own certain count is what matters.</b> ${G.DOUBT}</p>
      <button class="btn ghost" data-action="close-modal">Cancel</button>
    </div>
  </div>`;
}

// ───────────────────────── Other pages ─────────────────────────

function prepPage(ctx) {
  const done = C.PREP_CHECKLIST.filter((i) => ctx.prefs.checklist[i.id]).length;
  return html`${pageHeader('Umrah preparation', `${done} of ${C.PREP_CHECKLIST.length} ready`)}
    <section class="card checks">
      ${C.PREP_CHECKLIST.map((i) => html`<label class="check">
        <input type="checkbox" data-action="prep-toggle" data-id="${i.id}" ${ctx.prefs.checklist[i.id] ? 'checked' : ''}>
        <span><b>${i.label}</b>${i.link ? html`<a href="${i.link}">Open →</a>` : ''}</span></label>`)}
    </section>
    <a class="btn primary" href="#/ihram">Next: Understand Ihram →</a>`;
}

function ihramPage() {
  return html`${pageHeader('Understand Ihram', 'What it is, how to enter it, what to wear, and what becomes forbidden.')}
    <p>${reviewBadge(C.CONTENT_META.review)}</p>
    ${C.IHRAM_GUIDE.map((sec) => html`<section class="card"><h2>${sec.title}</h2>${pointsList(sec.points)}</section>`)}
    ${duaCard(dua('talbiyah'))}`;
}

function miqatPage(ctx) {
  const s = ctx.state.session;
  return html`${pageHeader('Miqat guide', G.MIQAT.lead)}
    ${miqatPanel(ctx, s?.miqat?.route_id ?? ctx.prefs.miqatRoute)}
    ${pointsList(G.MIQAT.points)}
    <section class="card"><h2>The five Miqats</h2>
      ${C.MIQATS.map((m) => html`<div class="miqat"><b>${m.name}</b> <span class="muted">— ${m.modern}</span><small>${m.forWho} About ${Math.round(miqatRadiusKm(m))} km from Makkah.</small></div>`)}
    </section>`;
}

function duaContext(s) {
  if (!s || s.status !== 'active') return null;
  const p = parseStage(s.current_stage);
  if (p.kind === 'tawaf' || s.current_stage === STAGE.TAWAF_READY) return 'tawaf';
  if (p.kind === 'sai' || s.current_stage === STAGE.SAFA) return 'sai';
  if (s.current_stage === STAGE.TWO_RAKAH || s.current_stage === STAGE.ZAMZAM || s.current_stage === STAGE.TAWAF_COMPLETE) return 'after-tawaf';
  if (s.current_stage === STAGE.ENTER_HARAM) return 'haram';
  if ([STAGE.MIQAT, STAGE.IHRAM, STAGE.TALBIYAH].includes(s.current_stage)) return 'ihram';
  return null;
}

function duasPage(ctx) {
  const s = ctx.state.session;
  const context = duaContext(s);
  const relevant = (d) => (context && d.contexts.includes(context) ? 1 : 0);
  return html`${pageHeader('Duas', context ? 'What fits your current step is shown first.' : 'Arabic, transliteration and meaning, with sources.')}
    ${s?.status === 'active' ? html`<a class="btn" href="#/">← Back to ${stageTitle(s.current_stage)}</a>` : ''}
    <p class="alert info">${context === 'sai' ? C.SAI_DUA_NOTE : C.TAWAF_DUA_NOTE}</p>
    <nav class="chips" aria-label="Dua categories">
      ${C.DUA_CATEGORIES.map((c) => html`<button class="chip" data-action="scroll" data-target="dua-${c.id}">${c.icon} ${c.label}</button>`)}
    </nav>
    ${C.DUA_CATEGORIES.map((cat) => {
      if (cat.id === 'personal') return personalDuas(ctx, cat);
      const items = C.DUAS.filter((d) => d.category === cat.id).sort((a, b) => relevant(b) - relevant(a));
      return html`<section id="dua-${cat.id}" class="dua-section">
        <h2>${cat.icon} ${cat.label}</h2><p class="muted">${cat.intro}</p>
        ${items.map((d) => duaCard(d, { highlight: relevant(d) === 1 }))}
      </section>`;
    })}`;
}

function personalDuas(ctx, cat) {
  return html`<section id="dua-${cat.id}" class="dua-section">
    <h2>${cat.icon} ${cat.label}</h2><p class="muted">${cat.intro}</p>
    <ul class="personal">
      ${ctx.prefs.personalDuas.map((d) => html`<li><span>${d.text}</span><button class="btn small ghost" data-action="dua-remove" data-id="${d.id}" aria-label="Remove">✕</button></li>`)}
    </ul>
    <form class="card" data-action="dua-add">
      <label class="field"><span>Add a dua or a name to pray for</span><textarea name="text" rows="2" maxlength="500" required></textarea></label>
      <button class="btn" type="submit">Add</button>
    </form>
  </section>`;
}

function offlineRow(label, ok, note) {
  return html`<li class="${ok ? 'ok' : ''}"><span class="mark" aria-hidden="true">${ok ? '✓' : '○'}</span><span><b>${label}</b><small>${note}</small></span></li>`;
}

function offlinePage(ctx) {
  const o = ctx.ui.offline;
  const info = ctx.prefs.info;
  const rows = (o?.groups ?? []).map((g) =>
    offlineRow(g.label, g.cached, g.cached ? 'Saved on this device' : g.optional ? 'Not included in this build yet' : 'Not downloaded yet'),
  );
  rows.push(offlineRow('Maps', false, 'Offline Haram maps are not in this build yet'));
  rows.push(offlineRow('Emergency information', Boolean(info.emergencyPhone || info.leaderPhone), info.emergencyPhone || info.leaderPhone ? 'Saved on this device' : 'Add it in My info'));
  rows.push(offlineRow('Hotel information', Boolean(info.hotelName || info.hotelLat), info.hotelName || info.hotelLat ? 'Saved on this device' : 'Add it in My info'));
  return html`${pageHeader('Umrah offline pack', 'Download before you enter the Haram — mobile data is often unreliable inside.')}
    ${o?.busy ? html`<p class="muted">Checking…</p>` : ''}
    ${o?.error ? html`<p class="alert warn">${o.error}</p>` : ''}
    <ul class="offline-list">${rows}</ul>
    <button class="btn primary big" data-action="offline-download">⬇ Download / update offline pack</button>
    <p class="muted">Your Umrah progress is saved on this device after every step. The ritual tracker never needs internet.</p>`;
}

function field(info, name, label, { type = 'text', autocomplete = 'off', textarea = false } = {}) {
  const v = info[name] ?? '';
  return html`<label class="field"><span>${label}</span>${
    textarea ? html`<textarea name="${name}" rows="3">${v}</textarea>` : html`<input name="${name}" type="${type}" value="${v}" autocomplete="${autocomplete}">`
  }</label>`;
}

function infoPage(ctx) {
  const i = ctx.prefs.info;
  const hasLoc = Number.isFinite(i.hotelLat) && Number.isFinite(i.hotelLng);
  return html`${pageHeader('My info & emergency', 'Saved only on this device, available offline.')}
    ${errorBox(ctx)}
    <form class="card" data-action="save-info">
      <h2>Hotel</h2>
      ${field(i, 'hotelName', 'Hotel name')}
      ${field(i, 'hotelAddress', 'Address / directions', { textarea: true })}
      ${field(i, 'hotelPhone', 'Hotel phone', { type: 'tel' })}
      ${hasLoc
        ? html`<p>📍 Saved location: ${i.hotelLat.toFixed(5)}, ${i.hotelLng.toFixed(5)} ·
            <a href="https://www.google.com/maps/search/?api=1&query=${i.hotelLat},${i.hotelLng}" target="_blank" rel="noopener">Open in maps</a> <small class="muted">(needs internet)</small></p>`
        : ''}
      <button type="button" class="btn" data-action="hotel-here">📍 Save my current location as the hotel</button>
      <h2>Group</h2>
      ${field(i, 'groupName', 'Group / agency name')}
      ${field(i, 'leaderName', 'Group leader')}
      ${field(i, 'leaderPhone', 'Leader’s phone', { type: 'tel' })}
      <h2>Emergency</h2>
      ${field(i, 'emergencyName', 'Emergency contact')}
      ${field(i, 'emergencyPhone', 'Emergency contact phone', { type: 'tel' })}
      ${field(i, 'medical', 'Medical notes (conditions, medication, allergies, blood type)', { textarea: true })}
      <button class="btn primary big" type="submit">Save on this device</button>
    </form>
    <section class="card">
      <h2>Emergency numbers (Saudi Arabia)</h2>
      <ul class="call-list">
        ${C.EMERGENCY_NUMBERS.map((e) => html`<li><a class="btn" href="tel:${e.number}">📞 ${e.number}</a> ${e.label}</li>`)}
        ${i.leaderPhone ? html`<li><a class="btn" href="tel:${i.leaderPhone}">📞 Leader</a> ${i.leaderName || 'Group leader'}</li>` : ''}
        ${i.emergencyPhone ? html`<li><a class="btn" href="tel:${i.emergencyPhone}">📞 Contact</a> ${i.emergencyName || 'Emergency contact'}</li>` : ''}
      </ul>
      <p class="muted">${C.EMERGENCY_NOTE}</p>
    </section>`;
}

const LOG_LABEL = {
  START: (e) => `Umrah started (guidance for a ${e.gender === 'male' ? 'man' : 'woman'})`,
  NEXT: (e) => `→ ${stageTitle(e.stage)}`,
  TOGGLE_CHECK: (e) => `Ihram check “${e.key}” ${e.value ? 'ticked' : 'unticked'}`,
  START_TAWAF: () => 'Tawaf started',
  CONFIRM_TAWAF_ROUND: (e) => `Tawaf round ${e.round ?? ''} confirmed${e.confidence && e.confidence !== 'manual' ? ` (location ${e.confidence})` : ''}`,
  CORRECT_TAWAF_ROUND: (e) => `Tawaf count corrected → now on round ${e.round}`,
  START_SAI: () => 'Sa’i started at Safa',
  CONFIRM_SAI_LAP: (e) => `Sa’i lap ${e.lap ?? ''} confirmed${e.confidence && e.confidence !== 'manual' ? ` (location ${e.confidence})` : ''}`,
  CORRECT_SAI_LAP: (e) => `Sa’i count corrected → now on lap ${e.lap}`,
  PAUSE: () => 'Paused',
  RESUME: () => 'Resumed',
  SET_TRACKING_MODE: (e) => `Location assistance ${e.mode === 'assisted' ? 'on' : 'off'}`,
  CONFIRM_HAIR: (e) => `Hair: ${e.method === 'shave' ? 'shaved' : 'shortened'}`,
  SET_MIQAT: () => 'Miqat route chosen',
  RESET: () => 'Session ended',
};

function journeyPage(ctx) {
  const sessions = [ctx.state.session, ...ctx.state.archive.slice().reverse()].filter(Boolean);
  if (!sessions.length) return html`${pageHeader('My journey')}<p>No journey yet. Start your Umrah from the Umrah tab.</p>`;
  const s = sessions.find((x) => x.id === ctx.route.arg) ?? sessions[0];
  const statusLabel = { active: 'In progress', complete: 'Complete', abandoned: 'Ended early' }[s.status];
  return html`${pageHeader('My journey', `${fmtDateTime(s.started_at)} · ${statusLabel}`)}
    ${sessions.length > 1
      ? html`<nav class="chips">${sessions.map((x) => html`<a class="chip ${x.id === s.id ? 'on' : ''}" href="#/journey/${x.id}">${fmtDateTime(x.started_at)}</a>`)}</nav>`
      : ''}
    <section class="card">
      <h2>Summary</h2>
      <dl class="summary">
        <dt>Current / last step</dt><dd>${stageTitle(s.current_stage)}</dd>
        <dt>Tawaf</dt><dd>${summarize(s).tawafDone} / ${TAWAF_ROUNDS}</dd>
        <dt>Sa’i</dt><dd>${summarize(s).saiDone} / ${SAI_LAPS}</dd>
        <dt>Started</dt><dd>${fmtDateTime(s.started_at)}</dd>
        <dt>Completed</dt><dd>${fmtDateTime(s.completed_at)}</dd>
      </dl>
      <p class="muted">Times are an app record only — they are not a religious requirement.</p>
    </section>
    ${s.tawaf ? html`<section class="card"><h2>Tawaf rounds</h2>${roundTable(s.tawaf.rounds, 'round_number', 'Round')}</section>` : ''}
    ${s.sai ? html`<section class="card"><h2>Sa’i laps</h2>${roundTable(s.sai.laps, 'lap_number', 'Lap', true)}</section>` : ''}
    ${s.corrections.length
      ? html`<section class="card"><h2>Count corrections</h2><ul>${s.corrections.map((c) => html`<li>${fmtTime(c.at)} — ${c.kind === 'tawaf' ? 'Tawaf' : 'Sa’i'}: ${c.from === 'complete' ? 'complete' : `#${c.from}`} → #${c.to}</li>`)}</ul></section>`
      : ''}
    <section class="card"><h2>Timeline</h2>
      <ol class="timeline">${s.log.map((e) => html`<li><time>${fmtTime(e.at)}</time> ${(LOG_LABEL[e.type] ?? (() => e.type))(e)}</li>`)}</ol>
    </section>
    <div class="row">
      <button class="btn" data-action="export" data-id="${s.id}">⬇ Export journey (JSON)</button>
      ${s.status === 'active' ? html`<button class="btn danger" data-action="end-session">End this session</button>` : ''}
    </div>`;
}

function roundTable(records, field, noun, withDirection = false) {
  if (!records.length) return html`<p class="muted">None confirmed yet.</p>`;
  return html`<div class="table-wrap"><table>
    <thead><tr><th>${noun}</th>${withDirection ? html`<th>Direction</th>` : ''}<th>Started</th><th>Completed</th><th>Recorded by</th></tr></thead>
    <tbody>${records.map((r) => html`<tr>
      <td>✓ ${r[field]}</td>
      ${withDirection ? html`<td>${PLACE_LABEL[r.start_location]} → ${PLACE_LABEL[r.end_location]}</td>` : ''}
      <td>${fmtTime(r.started_at)}</td><td>${fmtTime(r.completed_at)}</td>
      <td>${r.source === 'correction' ? 'Correction' : r.tracking_confidence === 'manual' ? 'Manual' : `Location (${r.tracking_confidence})`}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function guidePage(ctx) {
  const g = C.GUIDES[ctx.route.arg];
  if (!g) return html`${pageHeader('Guide not found')}<a href="#/more">Back</a>`;
  return html`${pageHeader(g.title)}
    <section class="card">${pointsList(g.points)}</section>
    <section class="card"><h2>Coming later</h2>${pointsList(g.planned)}</section>`;
}

function aboutPage() {
  return html`${pageHeader('About this guide')}
    <section class="card"><h2>Content review status</h2>
      <p>${reviewBadge(C.CONTENT_META.review)} Version ${C.CONTENT_META.version}</p>
      <p>${C.CONTENT_META.note}</p></section>
    <section class="card"><h2>Your count is what counts</h2>
      <p>The app keeps a record of your rounds and laps to help you. It is never an authority over your own count. If the app and your memory disagree, go with what you are certain of and correct the app.</p></section>
    <section class="card"><h2>Location assistance</h2>
      <p>Location can only <em>suggest</em> that a round or lap may be finished — it never marks one complete. GPS is often inaccurate inside and around the Haram, and the site geometry in this build is approximate until surveyed on site.</p></section>
    <section class="card"><h2>Privacy</h2>
      <p>Your progress, notes and personal information stay on this device. Nothing is sent anywhere.</p></section>`;
}

function mapPage(ctx) {
  const m = ctx.ui.map;
  const s = ctx.state.session;
  const p = s ? parseStage(s.current_stage) : { kind: 'simple' };
  const r = ctx.ui.reading;
  return html`${pageHeader('Map', 'Masjid al-Haram. Works offline.')}
    ${m.error ? html`<p class="alert warn">${m.error}</p>` : ''}
    <section class="card map-page">
      ${haramMap({
        pilgrim: m.position ?? r?.position ?? null,
        accuracyM: m.accuracyM ?? r?.position?.accuracyM ?? null,
        trail: m.trail,
        saiFromSafa: p.kind === 'sai' ? (r?.fromSafa ?? null) : null,
        focus: p.kind === 'simple' ? null : p.kind,
      })}
    </section>
    <div class="row">
      <button class="btn ${m.live ? 'primary' : ''}" data-action="map-live">${m.live ? '⏹ Stop showing my location' : '📍 Show my location'}</button>
      ${m.trail.length ? html`<button class="btn" data-action="map-clear">Clear trail</button>` : ''}
    </div>
    ${m.live
      ? m.position
        ? html`<p class="tracking-line ok">📡 Live · accuracy about ±${Math.round(m.accuracyM ?? 0)} m</p>`
        : html`<p class="tracking-line">📡 Waiting for a location fix…</p>`
      : ''}
    <section class="card"><h2>What you are looking at</h2>
      <ul class="points">
        <li><b>Kaaba</b>, with the Black Stone corner and the <b>START</b> line: every Tawaf round begins and ends there.</li>
        <li><b>Ḥijr Ismāʿīl</b>: the semicircular wall. Walk outside it — it is part of the Kaaba.</li>
        <li><b>Maqām Ibrāhīm</b>: where the two rak’ahs after Tawaf are prayed if there is space.</li>
        <li><b>Mas’a</b>: Safa at the south end, Marwah at the north, with the green-marker section marked.</li>
      </ul>
      <p class="muted">Schematic map drawn from the app’s site coordinates; distances are approximate until the site survey. For gates and services, follow the mosque’s own signs and staff.</p>
    </section>`;
}

function settingsPage(ctx) {
  const v = ctx.ui.voice;
  const s = ctx.state.session;
  return html`${pageHeader('Settings')}
    <section class="card">
      <h2>🔊 Voice guide</h2>
      <p class="muted">Speaks every step, round, corner and arrival out loud using your phone’s own voice. Works offline, and keeps talking while the screen is off.</p>
      ${v.available
        ? html`<label class="check"><input type="checkbox" data-action="voice-toggle" ${v.enabled ? 'checked' : ''}>
            <span><b>Voice guide</b><small>Spoken guidance in English.</small></span></label>
          <label class="check"><input type="checkbox" data-action="voice-arabic" ${v.arabic ? 'checked' : ''}>
            <span><b>Recite the Arabic aloud</b><small>Reads the Arabic of every dua, then its meaning. A phone voice is not a reciter and can mispronounce — where a recitation file exists, that is played instead.</small></span></label>
          <p class="${v.arabicVoice ? 'muted' : 'alert warn'}">${
            v.arabicVoice
              ? '✓ An Arabic voice is installed on this device.'
              : 'No Arabic voice found on this device, so the transliteration is read instead. Android: Settings → System → Languages & input → Text-to-speech → install Arabic. iPhone: Settings → Accessibility → Spoken Content → Voices → Arabic.'
          }</p>
          <button class="btn" data-action="voice-test">▶ Test the voice</button>`
        : html`<p class="alert warn">This device or browser has no speech voice available.</p>`}
    </section>
    <section class="card">
      <h2>🕌 Recited audio</h2>
      <p>When a recording is present the app plays the reciter instead of the phone voice: <code>audio/talbiyah.mp3</code> for the Talbiyah, and <code>audio/duas/&lt;id&gt;.mp3</code> for each dua.</p>
      <p class="muted">No recordings are included in this build. They have to come from a reciter whose recording you have permission to distribute — see audio/README.md.</p>
    </section>
    <section class="card">
      <h2>📡 Counting</h2>
      ${s ? html`<p>Location assistance is <b>${s.tracking_mode === 'assisted' ? 'on' : 'off'}</b> for this Umrah.</p>` : ''}
      <ul class="offline-list">
        <li class="${ctx.ui.sensors.compass ? 'ok' : ''}"><span class="mark" aria-hidden="true">${ctx.ui.sensors.compass ? '✓' : '○'}</span>
          <span><b>Compass</b><small>${ctx.ui.sensors.compass ? 'Working — it counts your turning when GPS is weak.' : 'Not seen yet. It starts when a round or lap does.'}</small></span></li>
        <li class="${ctx.ui.sensors.steps ? 'ok' : ''}"><span class="mark" aria-hidden="true">${ctx.ui.sensors.steps ? '✓' : '○'}</span>
          <span><b>Step sensor</b><small>${ctx.ui.sensors.steps ? 'Working — it carries a Sa’i lap where GPS drops out.' : 'Not seen yet. It starts when a round or lap does.'}</small></span></li>
      </ul>
      <p><b>Your step length:</b> ${ctx.ui.stepLengthM ? `${ctx.ui.stepLengthM.toFixed(2)} m` : 'not measured yet'}</p>
      <small>Measured by itself on a Sa’i lap where GPS is good, then used to count laps under the covered Mas’a where GPS fails.</small>
      ${ctx.ui.stepLengthM ? html`<button class="btn" data-action="reset-step-length">Measure it again</button>` : ''}
    </section>`;
}

function morePage(ctx) {
  const s = ctx.state.session;
  return html`${pageHeader('More')}
    <section class="tiles">
      ${tile('#/prep', '🧳', 'Preparation', '')}
      ${tile('#/info', '🆘', 'My info & emergency', '')}
      ${tile('#/settings', '⚙️', 'Settings & voice', '')}
      ${tile('#/ihram', '🤍', 'Understand Ihram', '')}
      ${tile('#/miqat', '📍', 'Miqat guide', '')}
      ${tile('#/offline', '⬇️', 'Offline pack', '')}
      ${tile('#/guide/makkah', '🕋', 'Makkah guide', '')}
      ${tile('#/guide/madinah', '🕌', 'Madinah guide', '')}
      ${tile('#/about', 'ℹ️', 'About & content review', '')}
    </section>
    ${s?.status === 'active' ? html`<button class="btn danger" data-action="end-session">End current Umrah session</button>` : ''}`;
}
