// Pure view functions: (context) -> markup. No DOM access, so every screen can
// be rendered and tested in Node. Every word the pilgrim reads goes through t().
//
// Layout rule for "everyone can understand it": each step shows one big icon,
// one clear instruction and one big button. Everything else folds away under
// "More guidance".
import { html, raw } from './html.js';
import { STAGE, TAWAF_ROUNDS, SAI_LAPS, PLACE_LABEL, parseStage, saiDirection, progressOf, stageTitle, isIhramActive } from '../engine/stages.js';
import { IHRAM_CHECKS, summarize } from '../engine/machine.js';
import { HARAM_GEO, MAP_RANGE_M } from '../engine/tracking.js';
import { miqatRadiusKm } from '../engine/miqat.js';
import * as C from '../data/content.js';
import { t, tList, LANGUAGES, getLanguage, languageInfo } from '../i18n/index.js';
import { duaCard, hasRecitation, listenButton, playAllButton, progressBar, reviewBadge, roundDots, saiTrack, setRecitations, tawafRing } from './components.js';
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
    voice: { available: false, enabled: false, voiceURI: null, voices: [] },
    playback: { playingId: null, currentTime: 0, duration: 0, rate: 1, queue: null },
    map: { live: false, trail: [], position: null, accuracyM: null, distanceM: null, error: null },
    miqatWatching: false,
    stepLengthM: null,
    sensors: { compass: false, steps: false },
    recitations: null,
    openDetails: new Set(),
    readyChecks: {},
    sim: { enabled: simulate, dropped: false },
  };
}

const dua = (id) => C.DUAS.find((d) => d.id === id);
const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
const LOCALES = { en: 'en-GB', hi: 'hi-IN', ta: 'ta-IN', ml: 'ml-IN' };
const locale = () => LOCALES[getLanguage()] ?? 'en-GB';
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: 'numeric', minute: '2-digit' }) : '—');
const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const place = (id) => t(PLACE_LABEL[id]);

export const STEPS = [
  { icon: '📍', name: 'Miqat' },
  { icon: '🤍', name: 'Ihram' },
  { icon: '📣', name: 'Talbiyah' },
  { icon: '🕌', name: 'Masjid al-Haram' },
  { icon: '🕋', name: 'Tawaf' },
  { icon: '🧎', name: 'Two rak’ahs' },
  { icon: '💧', name: 'Zamzam' },
  { icon: '🚶', name: 'Sa’i' },
  { icon: '✂️', name: 'Hair' },
  { icon: '✅', name: 'Complete' },
];
const STEP_OF = {
  MIQAT: 1, IHRAM: 2, TALBIYAH: 3, ENTER_HARAM: 4, TAWAF_READY: 5, TAWAF_COMPLETE: 5, TWO_RAKAH: 6,
  ZAMZAM: 7, SAFA: 8, SAI_COMPLETE: 8, HAIR: 9, IHRAM_EXIT: 10, UMRAH_COMPLETE: 10,
};
function stepOf(stage) {
  const p = parseStage(stage);
  if (p.kind === 'tawaf') return 5;
  if (p.kind === 'sai') return 8;
  return STEP_OF[stage] ?? 1;
}

export function stageName(id) {
  const p = parseStage(id);
  if (p.kind === 'tawaf') return t('Tawaf — Round {n} / {total}', { n: p.n, total: TAWAF_ROUNDS });
  if (p.kind === 'sai') return t('Sa’i — Lap {n} / {total}', { n: p.n, total: SAI_LAPS });
  return t(stageTitle(id));
}

// ───────────────────────── Shell ─────────────────────────

const PAGES = {
  '': guidedPage,
  language: languagePage,
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
  setRecitations(ctx.ui.recitations?.files, ctx.ui.playback);
  const chooseLanguage = !ctx.prefs.language;
  const page = chooseLanguage ? languagePage : (PAGES[ctx.route.name] ?? guidedPage);
  return html`
    ${topBar(ctx)}
    <a class="review-strip" href="#/about">⚠ ${t(C.REVIEW_NOTICE)}</a>
    <main class="page" lang="${getLanguage()}" dir="${languageInfo().dir}">
      ${ctx.ui.notice ? html`<p class="alert info" role="status">${ctx.ui.notice}</p>` : ''}
      ${page(ctx)}
    </main>
    ${audioBar(ctx)}
    ${chooseLanguage ? '' : tabBar(ctx)}
    ${ctx.ui.modal ? modal(ctx) : ''}`;
}

function topBar(ctx) {
  const s = ctx.state.session;
  return html`<header class="topbar">
    <a class="brand" href="#/"><span aria-hidden="true">🕋</span> ${t('Guided Umrah')}</a>
    <div class="topbar-actions">
      ${s?.status === 'active' && isIhramActive(s.current_stage) ? html`<span class="chip ok">🟢 ${t('Ihram')}</span>` : ''}
      <a class="chip ok" href="#/language" aria-label="${t('Language')}">🌐 ${languageInfo().native}</a>
      ${ctx.ui.voice.available
        ? html`<button class="chip ok" data-action="voice-quick" aria-pressed="${ctx.ui.voice.enabled}" aria-label="${t('Voice guide')}">${ctx.ui.voice.enabled ? '🔊' : '🔇'}</button>`
        : ''}
      ${ctx.ui.sim.enabled
        ? html`<button class="chip ${ctx.ui.sim.dropped ? 'warn' : 'ok'}" data-action="sim-drop" aria-pressed="${ctx.ui.sim.dropped}" title="${t('Simulated GPS')}" aria-label="${t('Simulated GPS')} — ${ctx.ui.sim.dropped ? t('Restore signal') : t('Drop signal')}">🛰</button>`
        : ''}
    </div>
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
  return html`<nav class="tabbar" aria-label="${t('Main')}">
    ${tabs.map(([r, icon, label]) => html`<a href="#/${r}" ${ctx.route.name === r ? raw('aria-current="page"') : ''}><span aria-hidden="true">${icon}</span>${t(label)}</a>`)}
  </nav>`;
}

function audioBar(ctx) {
  const s = ctx.state.session;
  if (!ctx.ui.audio.playing || (ctx.route.name === '' && s?.current_stage === STAGE.TALBIYAH)) return '';
  return html`<div class="audio-bar" role="status">🔊 ${t('Talbiyah playing')}${ctx.ui.audio.loop ? ` (${t('repeating')})` : ''}
    <button class="btn small" data-action="audio-toggle">${t('Pause')}</button></div>`;
}

// ───────────────────────── Shared bits ─────────────────────────

const errorBox = (ctx) => (ctx.ui.error ? html`<p class="alert error" role="alert">${ctx.ui.error}</p>` : '');
const pointsList = (items) => (items?.length ? html`<ul class="points">${tList(items).map((p) => html`<li>${p}</li>`)}</ul>` : '');
const genderPoints = (g, gender) => (gender === 'male' ? g.men : g.women) ?? [];

/** A foldable section that stays open across re-renders (GPS updates redraw the screen). */
function details(ctx, key, summary, body, className = 'card') {
  const open = ctx.ui.openDetails?.has(key);
  return html`<details class="${className}" ${open ? raw('open') : ''}>
    <summary data-action="toggle-details" data-key="${key}">${summary}</summary>
    ${body}
  </details>`;
}

function stepHero(s, title, lead) {
  const n = stepOf(s.current_stage);
  return html`<section class="step-card">
    <div class="step-icon" aria-hidden="true">${STEPS[n - 1].icon}</div>
    <p class="eyebrow">${t('Step {n} of {total}', { n, total: STEPS.length })} · ${t(STEPS[n - 1].name)}</p>
    <h1>${title}</h1>
    ${lead ? html`<p class="lead">${lead}</p>` : ''}
  </section>`;
}

function pageHeader(title, lead) {
  return html`<header class="stage-head"><h1>${title}</h1>${lead ? html`<p class="lead">${lead}</p>` : ''}</header>`;
}

const continueBtn = (s, label) => html`<button class="btn primary big" data-action="next" data-expect="${s.current_stage}">${label}</button>`;

function tile(href, icon, title, sub) {
  return html`<a class="tile" href="${href}"><span class="tile-icon" aria-hidden="true">${icon}</span><b>${title}</b>${sub ? html`<small>${sub}</small>` : ''}</a>`;
}

function stepStrip(stage) {
  const current = stepOf(stage);
  return html`<ol class="steps" aria-label="${t('Umrah steps')}">
    ${STEPS.map((step, i) => {
      const n = i + 1;
      const state = n < current ? 'done' : n === current ? 'current' : '';
      return html`<li class="${state}" title="${t(step.name)}"><span aria-hidden="true">${n < current ? '✓' : step.icon}</span></li>`;
    })}
  </ol>`;
}

// ───────────────────────── Language ─────────────────────────

function languagePage(ctx) {
  return html`<section class="hero center">
    <div class="step-icon" aria-hidden="true">🌐</div>
    <h1>Choose your language</h1>
    <p class="lead">भाषा चुनें · மொழியைத் தேர்ந்தெடுக்கவும் · ഭാഷ തിരഞ്ഞെടുക്കുക</p>
    <div class="lang-grid">
      ${LANGUAGES.map((l) => html`<button class="btn big ${l.code === ctx.prefs.language ? 'primary' : ''}" data-action="set-language" data-code="${l.code}">
        <span class="lang-native">${l.native}</span><small>${l.name}</small></button>`)}
    </div>
  </section>`;
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
  return html`<section class="status-card" aria-label="${t('My Umrah progress')}">
    <div class="status-row"><span class="eyebrow">${t('My Umrah')}</span>
      ${ctx.undoAvailable ? html`<button class="link" data-action="undo">↶ ${t('Undo last step')}</button>` : ''}</div>
    ${stepStrip(s.current_stage)}
    <div class="status-overall">${progressBar(pct, t('Overall Umrah progress'))}<b>${Math.round(pct * 100)}%</b></div>
    <p class="status-current"><span class="muted">${t('Now')}</span> <b>${stageName(s.current_stage)}</b>
      ${d ? html`<span class="status-dir">${place(d.from)} → ${place(d.to)}</span>` : ''}
      ${s.paused ? html`<span class="chip warn">${t('Paused')}</span>` : ''}</p>
  </section>`;
}

function justDone(ctx) {
  const j = ctx.ui.justCompleted;
  if (!j) return '';
  if (j.kind === 'tawaf') {
    return html`<p class="alert success" role="status">✓ ${t('Round {n} completed', { n: j.n })}${j.n === TAWAF_ROUNDS ? ` — ${t('Tawaf finished')}` : ''}</p>`;
  }
  const d = saiDirection(j.n);
  const next = j.n < SAI_LAPS ? saiDirection(j.n + 1) : null;
  return html`<p class="alert success" role="status">✓ ${t('{place} reached — Lap {n} complete', { place: place(d.to), n: j.n })}${
    next ? html`. ${t('Next')}: <b>${place(next.from)} → ${place(next.to)}</b>` : ''
  }</p>`;
}

function stageBody(s, ctx) {
  const p = parseStage(s.current_stage);
  if (p.kind === 'tawaf') return tawafRoundView(s, p.n, ctx);
  if (p.kind === 'sai') return saiLapView(s, p.n, ctx);
  const view = SIMPLE_VIEWS[s.current_stage];
  return view ? view(s, ctx) : html`<p class="alert error">${t('Unknown step')}: ${s.current_stage}</p>`;
}

function homePage(ctx) {
  const prepDone = C.PREP_CHECKLIST.filter((i) => ctx.prefs.checklist[i.id]).length;
  return html`
    <section class="hero">
      <div class="step-icon" aria-hidden="true">🕋</div>
      <p class="eyebrow">${t('Guided Umrah Mode')}</p>
      <h1>${t('Your Umrah, one step at a time.')}</h1>
      <p>${t('The app shows you what to do now, counts your rounds, and tells you when you are finished. It works without internet.')}</p>
      ${errorBox(ctx)}
      <form class="start-form" data-action="start">
        <fieldset class="segmented">
          <legend>${t('Show guidance for')}</legend>
          <label><input type="radio" name="gender" value="male" required><span>👳 ${t('Man')}</span></label>
          <label><input type="radio" name="gender" value="female"><span>🧕 ${t('Woman')}</span></label>
        </fieldset>
        <button class="btn primary big" type="submit">▶ ${t('Start Umrah')}</button>
      </form>
    </section>
    <section class="tiles">
      ${tile('#/prep', '🧳', t('Preparation'), t('{done} / {total} ready', { done: prepDone, total: C.PREP_CHECKLIST.length }))}
      ${tile('#/ihram', '🤍', t('Understand Ihram'), t('Clothing, intention, restrictions'))}
      ${tile('#/miqat', '📍', t('Miqat guide'), t('Based on your route'))}
      ${tile('#/offline', '⬇️', t('Offline pack'), t('Download before the Haram'))}
      ${tile('#/info', '🆘', t('My info & emergency'), t('Hotel, group, contacts'))}
      ${tile('#/duas', '🤲', t('Duas'), t('Arabic · recitation · meaning'))}
    </section>
    ${ctx.state.archive.length ? html`<p class="center"><a href="#/journey">${t('Past journeys')} (${ctx.state.archive.length})</a></p>` : ''}
    <p class="credit">${t('Designed and developed by Mhd Wasim')}</p>`;
}

function miqatPanel(ctx, routeId) {
  const route = C.routeById(routeId);
  const miqats = route ? C.MIQATS.filter((m) => route.miqats.includes(m.id)) : [];
  return html`<section class="card">
    <label class="field"><span>${t('Where are you travelling from?')}</span>
      <select data-action="miqat-route">
        <option value="">${t('Choose your route…')}</option>
        ${C.ROUTE_GROUPS.map((g) => html`<optgroup label="${t(g.label)}">
          ${C.ROUTES.filter((r) => r.group === g.id).map((r) => html`<option value="${r.id}" ${r.id === routeId ? 'selected' : ''}>${t(r.label)}</option>`)}
        </optgroup>`)}
      </select>
    </label>
    ${route
      ? html`<p class="lead">${t(route.note)}</p>
        ${miqats.map((m) => html`<div class="miqat"><b>${m.name}</b> <span class="muted">— ${m.modern}</span><small>${t(m.forWho)} ${t('About {km} km from Makkah in a straight line.', { km: Math.round(miqatRadiusKm(m)) })}</small></div>`)}
        ${pointsList(route.extra)}
        ${details(ctx, `route-steps:${route.mode}`, t('What to do, step by step'), pointsList(C.ROUTE_STEPS[route.mode] ?? []), 'card inner')}
        ${route.miqats.length ? miqatWatchControls(ctx) : ''}`
      : html`<p class="muted">${t('Flights are listed by country, roads and the train by where you set out from.')}</p>`}
    <p>${reviewBadge(C.CONTENT_META.review)}</p>
  </section>`;
}

function miqatWatchControls(ctx) {
  const on = ctx.ui.miqatWatching;
  return html`<div class="row">
    <button class="btn ${on ? 'primary' : ''}" data-action="miqat-watch">${on ? `⏹ ${t('Stop watching')}` : `🔔 ${t('Watch for my Miqat')}`}</button>
    <button class="btn" data-action="miqat-locate">📍 ${t('Check once')}</button>
  </div>
  ${on ? html`<p class="muted"><small>${t('Watching. Keep the app open or in the background — it will vibrate, speak and warn you as the Miqat line approaches.')}</small></p>` : ''}
  ${miqatReadingView(ctx.ui.miqatReading)}`;
}

function miqatReadingView(r) {
  if (!r) return '';
  if (r.busy) return html`<p class="muted">${t('Finding your location…')}</p>`;
  if (r.error) return html`<p class="alert warn">${t(r.error)}</p>`;
  const label = {
    far: 'Not near the Miqat yet',
    approaching: 'Approaching the Miqat — get ready now',
    reached: 'You have reached or passed the Miqat boundary',
  }[r.status];
  const km = Math.round(r.first.kmToBoundary);
  return html`<div class="alert ${r.status === 'far' ? 'info' : 'warn'}" role="status">
    <b>${t(label)}</b><br>
    ${km > 0 ? t('First Miqat line on your route: {name} — about {km} km to go.', { name: r.first.name, km }) : t('First Miqat line on your route: {name} — crossed.', { name: r.first.name })}<br>
    <small>${t('Approximate. The crew announcement or your group leader takes priority.')}</small>
  </div>`;
}

function trackingToggle(s) {
  const on = s.tracking_mode === 'assisted';
  return html`<section class="card tracking-toggle">
    <div><b>📡 ${on ? t('Location help is ON') : t('Location help is OFF')}</b>
      <small>${t('The phone only suggests when a round may be finished. You always confirm it yourself.')}</small></div>
    <button class="btn small" data-action="tracking" data-mode="${on ? 'manual' : 'assisted'}">${on ? t('Turn off') : t('Turn on')}</button>
  </section>`;
}

const MODE_LABEL = {
  'gps+compass': 'GPS + compass',
  'gps+steps': 'GPS + steps',
  gps: 'GPS',
  compass: 'Compass only — GPS is weak here',
  steps: 'Steps only — GPS is weak here',
};
const CONFIDENCE_LABEL = { high: 'high confidence', medium: 'medium confidence', low: 'low confidence — check it yourself' };

function sourceChips(r) {
  if (!r || r.status !== 'ok') return '';
  const steps = r.stepsThisRound ?? r.stepsThisLap ?? null;
  const on = (yes) => (yes ? 'on' : '');
  return html`<div class="sources">
    <span class="chip ${on(r.mode?.includes('gps'))}">📡 GPS</span>
    ${r.headingProgress === undefined ? '' : html`<span class="chip ${on(r.mode?.includes('compass'))}">🧭 ${t('Turning')}</span>`}
    <span class="chip ${on(r.mode?.includes('steps'))}">👣 ${t('{n} steps', { n: steps ?? 0 })}</span>
    ${r.confidence ? html`<span class="chip ${r.confidence === 'low' ? 'warn' : ''}">${t(CONFIDENCE_LABEL[r.confidence])}</span>` : ''}
  </div>`;
}

function cornerChecks(checkpoints, nearStart) {
  if (!checkpoints) return '';
  const items = [
    ['iraqi', 'ʿIrāqī'],
    ['shami', 'Shāmī'],
    ['yemeni', 'Yemeni'],
  ];
  const all = items.every(([k]) => checkpoints[k]);
  return html`<ol class="corners" aria-label="${t('Corners passed this round')}">
    ${items.map(([key, label]) => html`<li class="${checkpoints[key] ? 'done' : ''}">${checkpoints[key] ? '✓' : '○'} ${t(label)}</li>`)}
    <li class="${all && nearStart ? 'done' : ''}">${all && nearStart ? '✓' : '○'} ${t('Black Stone')}</li>
  </ol>`;
}

/** Where you are beside the Kaaba, what to do there, and the recitation for that spot. */
function sectorCard(sector) {
  if (!sector) return '';
  return html`<section class="card sector">
    <b>📍 ${t('Now beside: {place}', { place: t(sector.label) })}</b>
    ${sector.tip ? html`<p>${t(sector.tip)}</p>` : ''}
    ${sector.duaId && hasRecitation(sector.duaId) ? listenButton(sector.duaId) : ''}
  </section>`;
}

// The manual/automatic tracking status, shown as a clear card+button (not a
// small text link) so the choice is obvious on every round/lap screen, not
// just before starting; the full weak-signal warning when counting is not possible.
function trackingStatus(s, r, lastConfirmed) {
  if (s.tracking_mode !== 'assisted') {
    return html`<section class="card tracking-toggle">
      <div><b>📍 ${t('Location help is OFF')}</b>
        <small>${t('The phone only suggests when a round may be finished. You always confirm it yourself.')}</small></div>
      <button class="btn small" data-action="tracking" data-mode="assisted">${t('Turn on')}</button>
    </section>`;
  }
  const offBtn = html`<button class="btn small" data-action="tracking" data-mode="manual">${t('Turn off')}</button>`;
  if (!r || r.status === 'waiting') {
    return html`<section class="card tracking-toggle">
      <div><b>📡 ${t('Waiting for a location fix…')}</b></div>
      ${offBtn}
    </section>`;
  }
  if (r.status === 'ok') {
    return html`<section class="card tracking-toggle ok">
      <div><b>📡 ${t(MODE_LABEL[r.mode] ?? 'Tracking')}</b></div>
      ${offBtn}
    </section>`;
  }
  const why = {
    weak: 'Tracking signal weak',
    denied: 'Location permission denied',
    unavailable: 'Location unavailable',
    unsupported: 'Location is not supported on this device',
    out_of_area: 'You seem to be outside the tracking area',
  }[r.status] ?? 'Tracking unavailable';
  return html`<div class="alert warn" role="alert">
    <b>⚠ ${t(why)}</b>
    <p>${t('We cannot reliably determine your current position.')}</p>
    <p>${t('Your last confirmed progress:')}<br><b>${lastConfirmed}</b></p>
    <p>${t('Please count yourself and confirm manually.')}</p>
    <button class="btn" data-action="tracking" data-mode="manual">${t('Continue manually')}</button>
  </div>`;
}

function pausedCard(ritual, label) {
  return html`<section class="card paused" role="status">
    <p class="eyebrow">${t('Paused')}</p>
    <h2>${label}</h2>
    <p>${t('Tracking paused. Take your time — water, rest, prayer, family.')}</p>
    <p class="muted">${t(G.PAUSE)}</p>
    <div class="row">
      <button class="btn primary" data-action="resume">▶ ${t('Resume')}</button>
      <button class="btn" data-action="open-correct" data-ritual="${ritual}">${ritual === 'tawaf' ? t('Correct round') : t('Correct lap')}</button>
    </div>
  </section>`;
}

function countList(records, field, noun, withDirection = false) {
  return html`<ul class="count-list">
    ${records.map((r) => {
      const n = r[field];
      const dir = withDirection ? ` · ${place(r.start_location)} → ${place(r.end_location)}` : '';
      return html`<li><span>✓ ${noun === 'Round' ? t('Round {n}', { n }) : t('Lap {n}', { n })}${dir}</span><small>${r.source === 'correction' ? t('set by correction') : fmtTime(r.completed_at)}</small></li>`;
    })}
  </ul>`;
}

function actionRow(s, ritual) {
  return html`<div class="row actions">
    <a class="btn" href="#/duas">🤲 ${t('Duas')}</a>
    ${s.paused ? '' : html`<button class="btn" data-action="pause">⏸ ${t('Pause')}</button>`}
    ${s.paused ? '' : html`<button class="btn" data-action="open-correct" data-ritual="${ritual}">${t('Wrong count?')}</button>`}
  </div>`;
}

// The ring, sector and suggestion banner change on almost every GPS/compass
// sample — factored out so a live update can patch just this DOM region
// instead of the whole page (see app.js patchLiveTracking). The button that
// confirms the round sits outside both live regions so it is never torn down
// and rebuilt mid-tap while tracking is running.
export function tawafLiveTop(s, n, ctx) {
  const r = ctx.ui.reading;
  const fix = s.tracking_mode === 'assisted' && r?.status === 'ok';
  return html`
    ${tawafRing({ progress: fix ? r.progress : null, startBearing: HARAM_GEO.blackStoneBearingDeg })}
    <p class="left-hint">🕋 ${t('Kaaba is on your')} <b>${t('LEFT')}</b></p>
    ${sectorCard(fix ? r.sector : null)}
    ${fix && r.suggestCompletion
      ? html`<div class="alert suggest" role="status"><b>${t('Possible round completion')}</b><br>${t('You appear to have reached the starting point. Confirm only if you have completed Round {n}.', { n })}</div>`
      : ''}`;
}

export function tawafLiveBottom(s, n, ctx) {
  const r = ctx.ui.reading;
  const assisted = s.tracking_mode === 'assisted';
  const fix = assisted && r?.status === 'ok';
  const lastConfirmed = t('Tawaf — {done} of {total} rounds confirmed (you are on Round {n})', { done: s.tawaf.rounds.length, total: TAWAF_ROUNDS, n });
  return html`
    ${s.paused ? '' : trackingStatus(s, r, lastConfirmed)}
    ${assisted
      ? html`<section class="card">
          <h2>🗺 ${t('Map and tracking details')}</h2>
          ${cornerChecks(fix ? r.checkpoints : null, r?.nearStart)}
          ${sourceChips(r)}
          ${haramMap({ pilgrim: r?.position ?? null, accuracyM: r?.position?.accuracyM ?? null, trail: ctx.ui.map.trail, focus: 'tawaf' })}
        </section>`
      : ''}`;
}

function tawafRoundView(s, n, ctx) {
  const done = s.tawaf.rounds.length;
  const final = n === TAWAF_ROUNDS;
  return html`
    <section class="counter ${final ? 'final' : ''}">
      <p class="eyebrow">${t('Tawaf')}${final ? ` · ${t('final round')}` : ''}</p>
      <h1 class="count">${t('Round')} <b>${n}</b> <span>/ ${TAWAF_ROUNDS}</span></h1>
      ${roundDots(done, n, TAWAF_ROUNDS)}
    </section>
    ${s.paused
      ? pausedCard('tawaf', t('Tawaf — Round {n} / {total}', { n, total: TAWAF_ROUNDS }))
      : html`
        <div id="live-top">${tawafLiveTop(s, n, ctx)}</div>
        <button class="btn primary big ${final ? 'final' : ''}" data-action="confirm-round" data-n="${n}" data-expect="${s.current_stage}">✓ ${t('Confirm Round {n} complete', { n })}</button>
        <p class="hint">${t('Tap when you are back at the Black Stone line (green light on the wall).')}</p>`}
    ${actionRow(s, 'tawaf')}
    ${s.gender === 'male' && n <= 3 ? html`<p class="alert info">${t(G.TAWAF_ROUND.ramal)}</p>` : ''}
    <div id="live-bottom">${tawafLiveBottom(s, n, ctx)}</div>
    ${details(ctx, 'tawaf:duas', `🤲 ${t('Duas and guidance for Tawaf')}`, html`
      ${pointsList(G.TAWAF_ROUND.points)}
      ${duaCard(dua('black-stone'))}
      ${duaCard(dua('yemeni-corner'))}`)}`;
}

function greenMarkerCard(gender, green) {
  const men = gender === 'male';
  const heads = {
    inside: men ? 'Jogging zone — jog if you are able' : 'Green markers — keep walking normally',
    ahead: 'Green markers ahead',
    passed: 'Green markers passed',
  };
  return html`<section class="card green ${green === 'inside' ? 'active' : ''}">
    <b>${green === 'passed' ? '✓' : '🟢'} ${t(heads[green] ?? 'Green markers')}</b>
    <p>${t(men ? G.SAI_LAP.men[0] : G.SAI_LAP.women[0])}</p>
  </section>`;
}

// Split for the same reason as tawafLiveTop/Bottom — see the comment there.
export function saiLiveTop(s, n, ctx) {
  const d = saiDirection(n);
  const r = ctx.ui.reading;
  const fix = s.tracking_mode === 'assisted' && r?.status === 'ok';
  const final = n === SAI_LAPS;
  const to = place(d.to);
  return html`
    <div class="sai-layout">
      ${saiTrack({ direction: d.key, fromSafa: fix ? r.fromSafa : null, greenZone: HARAM_GEO.greenZone })}
      ${greenMarkerCard(s.gender, fix ? r.green : null)}
    </div>
    ${fix && r.suggestCompletion
      ? html`<div class="alert suggest" role="status"><b>${t('{place} reached?', { place: to })}</b><br>${final ? t('You are approaching the final destination.') : t('You appear to be at {place}.', { place: to })} ${t('Confirm only when you have arrived.')}</div>`
      : ''}`;
}

export function saiLiveBottom(s, n, ctx) {
  const d = saiDirection(n);
  const r = ctx.ui.reading;
  const assisted = s.tracking_mode === 'assisted';
  const fix = assisted && r?.status === 'ok';
  return html`
    ${s.paused ? '' : trackingStatus(s, r, t('Sa’i — {done} of {total} laps confirmed (you are on Lap {n})', { done: s.sai.laps.length, total: SAI_LAPS, n }))}
    ${assisted
      ? html`<section class="card">
          <h2>🗺 ${t('Map and tracking details')}</h2>
          ${sourceChips(r)}
          ${haramMap({ saiFromSafa: fix ? r.fromSafa : null, trail: ctx.ui.map.trail, focus: 'sai' })}
        </section>`
      : ''}`;
}

function saiLapView(s, n, ctx) {
  const d = saiDirection(n);
  const done = s.sai.laps.length;
  const final = n === SAI_LAPS;
  const to = place(d.to);
  return html`
    <section class="counter ${final ? 'final' : ''}">
      <p class="eyebrow">${t('Sa’i')}${final ? ` · ${t('final lap')}` : ''}</p>
      <h1 class="count">${t('Lap')} <b>${n}</b> <span>/ ${SAI_LAPS}</span></h1>
      ${roundDots(done, n, SAI_LAPS)}
      <p class="direction">${place(d.from)} <span aria-hidden="true">→</span> <b>${to}</b></p>
    </section>
    ${s.paused
      ? pausedCard('sai', t('Sa’i — Lap {n} / {total}', { n, total: SAI_LAPS }))
      : html`
        <div id="live-top">${saiLiveTop(s, n, ctx)}</div>
        <button class="btn primary big ${final ? 'final' : ''}" data-action="confirm-lap" data-n="${n}" data-expect="${s.current_stage}">✓ ${t('I have reached {place}', { place: to })}</button>
        <p class="hint">${t('On reaching {place}: face the Kaaba, raise your hands, and repeat the dhikr and dua as at Safa.', { place: to })}</p>`}
    ${actionRow(s, 'sai')}
    <div id="live-bottom">${saiLiveBottom(s, n, ctx)}</div>
    ${details(ctx, 'sai:duas', `🤲 ${t('Duas and guidance for Sa’i')}`, html`
      ${pointsList(G.SAI_LAP.points)}
      ${duaCard(dua('safa-marwah-dhikr'))}
      ${duaCard(dua('green-markers'))}`)}`;
}

function checkList(items, checked, action) {
  return html`<section class="card checks">
    ${items.map((c) => html`<label class="check">
      <input type="checkbox" data-action="${action}" data-key="${c.id}" ${checked[c.id] ? 'checked' : ''}>
      <span><b>${t(c.label)}</b>${c.help ? html`<small>${t(c.help)}</small>` : ''}</span>
    </label>`)}
  </section>`;
}

const SIMPLE_VIEWS = {
  [STAGE.MIQAT]: (s, ctx) => html`
    ${stepHero(s, t('Approaching the Miqat'), t(G.MIQAT.lead))}
    ${miqatPanel(ctx, s.miqat?.route_id ?? ctx.prefs.miqatRoute)}
    ${continueBtn(s, t('I’m at the Miqat — enter Ihram'))}
    <p class="hint">${t('Already in Ihram? Continue — you will confirm it on the next screen.')}</p>
    ${details(ctx, 'more:MIQAT', t('More guidance'), pointsList(G.MIQAT.points))}`,

  [STAGE.IHRAM]: (s, ctx) => {
    const ready = IHRAM_CHECKS.every((k) => s.checks[k]);
    const items = IHRAM_CHECKS.map((k) => ({ id: k, ...G.IHRAM.checks[k] }));
    return html`
      ${stepHero(s, t('Ihram check'), t(G.IHRAM.lead))}
      ${checkList(items, s.checks, 'check')}
      <button class="btn primary big" data-action="next" data-expect="${s.current_stage}" ${ready ? '' : 'disabled'}>${t('Continue')}</button>
      ${ready ? '' : html`<p class="hint">${t('Tick all three to continue.')}</p>`}
      ${duaCard(dua('intention'))}
      ${duaCard(dua('labbayka-umrah'))}
      ${details(ctx, 'more:IHRAM', t('Optional condition, if you fear being prevented'), duaCard(dua('ishtirat')))}
      <p><a href="#/ihram">${t('Read the Ihram restrictions')} →</a></p>`;
  },

  [STAGE.TALBIYAH]: (s, ctx) => {
    const recorded = hasRecitation('talbiyah');
    return html`
      ${stepHero(s, t('Talbiyah'), t(G.TALBIYAH.lead))}
      <section class="card audio-controls">
        ${recorded
          ? html`<button class="btn primary big" data-action="audio-toggle">${ctx.ui.audio.playing ? `⏸ ${t('Pause')}` : `🎙 ${t('Play the Talbiyah')}`}</button>
            <label class="check inline"><input type="checkbox" data-action="audio-loop" ${ctx.ui.audio.loop ? 'checked' : ''}>
              <span>${t('Keep repeating while I use the app')}</span></label>`
          : html`<p class="muted">${t('No recitation recording for this dua yet.')}</p>`}
      </section>
      ${duaCard(dua('talbiyah'), { audio: false })}
      ${pointsList([...G.TALBIYAH.points, ...genderPoints(G.TALBIYAH, s.gender)])}
      ${continueBtn(s, t('I’ve arrived at Masjid al-Haram'))}`;
  },

  [STAGE.ENTER_HARAM]: (s, ctx) => html`
    ${stepHero(s, t('Makkah — Masjid al-Haram'), t(G.ENTER_HARAM.lead))}
    ${duaCard(dua('enter-mosque'))}
    ${continueBtn(s, t('Go to the Tawaf starting point'))}
    ${details(ctx, 'more:ENTER_HARAM', t('More guidance'), pointsList(G.ENTER_HARAM.points))}`,

  [STAGE.TAWAF_READY]: (s, ctx) => {
    const items = G.TAWAF_READY.ready.filter((c) => !c.men || s.gender === 'male');
    return html`
      ${stepHero(s, t('Tawaf — starting point'), t(G.TAWAF_READY.lead))}
      ${tawafRing({ startBearing: HARAM_GEO.blackStoneBearingDeg })}
      <p class="left-hint">🕋 ${t('Kaaba on your')} <b>${t('LEFT')}</b> · ${t('start at the Black Stone line')}</p>
      <h2>${t('Before you start')}</h2>
      ${checkList(items, ctx.ui.readyChecks, 'ready-check')}
      ${trackingToggle(s)}
      <button class="btn primary big" data-action="start-tawaf" data-expect="${s.current_stage}">▶ ${t('Start Round 1')}</button>
      ${duaCard(dua('black-stone'))}
      ${details(ctx, 'more:TAWAF_READY', t('More guidance'), pointsList(G.TAWAF_READY.points))}`;
  },

  [STAGE.TAWAF_COMPLETE]: (s, ctx) => html`
    <section class="done-card">
      <div class="step-icon" aria-hidden="true">✅</div>
      <p class="eyebrow">${t('Tawaf')}</p>
      <h1>${t('{done} / {total} complete', { done: summarize(s).tawafDone, total: TAWAF_ROUNDS })}</h1>
      ${countList(s.tawaf.rounds, 'round_number', 'Round')}
      <p class="muted">${t('Started {start} · Completed {end}', { start: fmtTime(s.tawaf.started_at), end: fmtTime(s.tawaf.completed_at) })}</p>
    </section>
    ${pointsList(genderPoints(G.TAWAF_COMPLETE, s.gender))}
    <p class="next-up">${t('Next')}: <b>${t('Pray two rak’ahs')}</b></p>
    ${continueBtn(s, t('Continue'))}
    <button class="btn ghost" data-action="open-correct" data-ritual="tawaf">${t('Wrong count?')}</button>`,

  [STAGE.TWO_RAKAH]: (s, ctx) => html`
    ${stepHero(s, t('Two rak’ahs'), t(G.TWO_RAKAH.lead))}
    ${pointsList(G.TWO_RAKAH.points)}
    ${continueBtn(s, t('I’ve prayed — continue'))}
    ${duaCard(dua('maqam'))}
    <button class="btn ghost" data-action="open-correct" data-ritual="tawaf">${t('Recount Tawaf')}</button>`,

  [STAGE.ZAMZAM]: (s, ctx) => html`
    ${stepHero(s, t('Zamzam'), t(G.ZAMZAM.lead))}
    ${pointsList(G.ZAMZAM.points)}
    ${continueBtn(s, t('Continue to Sa’i'))}
    ${duaCard(dua('zamzam'))}`,

  [STAGE.SAFA]: (s, ctx) => html`
    ${stepHero(s, t('Sa’i starts at SAFA'), t(G.SAFA.lead))}
    ${duaCard(dua('safa-verse'))}
    ${duaCard(dua('safa-marwah-dhikr'))}
    ${trackingToggle(s)}
    <button class="btn primary big" data-action="start-sai" data-expect="${s.current_stage}">▶ ${t('Start Sa’i — Lap 1: Safa → Marwah')}</button>
    ${details(ctx, 'more:SAFA', t('More guidance'), pointsList(G.SAFA.points))}`,

  [STAGE.SAI_COMPLETE]: (s, ctx) => html`
    <section class="done-card">
      <div class="step-icon" aria-hidden="true">✅</div>
      <p class="eyebrow">${t('Sa’i')}</p>
      <h1>${t('{done} / {total} complete', { done: summarize(s).saiDone, total: SAI_LAPS })}</h1>
      ${countList(s.sai.laps, 'lap_number', 'Lap', true)}
      <p><b>${t('END: MARWAH')}</b></p>
      <p class="muted">${t('Started {start} · Completed {end}', { start: fmtTime(s.sai.started_at), end: fmtTime(s.sai.completed_at) })}</p>
    </section>
    <p class="next-up">${t(G.SAI_COMPLETE.lead)}</p>
    ${continueBtn(s, t('Continue to the final step'))}
    <button class="btn ghost" data-action="open-correct" data-ritual="sai">${t('Wrong count?')}</button>`,

  [STAGE.HAIR]: (s, ctx) => {
    const opts = C.HAIR_OPTIONS[s.gender];
    return html`
      ${stepHero(s, t('Hair — final Umrah step'), t(G.HAIR.lead))}
      <form class="card" data-action="hair" data-expect="${s.current_stage}">
        <fieldset><legend>${s.gender === 'male' ? t('Men') : t('Women')}</legend>
          ${opts.map((o) => html`<label class="check">
            <input type="radio" name="method" value="${o.value}" ${opts.length === 1 ? 'checked' : ''} required>
            <span><b>${t(o.label)}</b><small>${t(o.note)}</small></span></label>`)}
        </fieldset>
        ${s.gender === 'male' ? pointsList(G.HAIR.points) : ''}
        <button class="btn primary big" type="submit">✓ ${t('Confirm — hair done')}</button>
      </form>
      <button class="btn ghost" data-action="open-correct" data-ritual="sai">${t('Recount Sa’i')}</button>`;
  },

  [STAGE.IHRAM_EXIT]: (s) => html`
    <section class="done-card">
      <p class="eyebrow">${t('Umrah status')}</p>
      <dl class="summary">
        <dt>${t('Ihram restrictions')}</dt><dd><b>${t('ENDED')}</b></dd>
        <dt>${t('Tawaf')}</dt><dd>✓ ${summarize(s).tawafDone}/${TAWAF_ROUNDS}</dd>
        <dt>${t('Sa’i')}</dt><dd>✓ ${summarize(s).saiDone}/${SAI_LAPS}</dd>
        <dt>${t('Hair')}</dt><dd>✓ ${s.hair?.method === 'shave' ? t('Shaved') : t('Shortened')}</dd>
      </dl>
    </section>
    <p class="lead">${t(G.IHRAM_EXIT.lead)}</p>
    ${continueBtn(s, t('Finish — mark my Umrah complete'))}`,

  [STAGE.UMRAH_COMPLETE]: (s) => {
    const sum = summarize(s);
    return html`<section class="complete">
      <p class="arabic big" lang="ar" dir="rtl">الحمد لله</p>
      <h1>${t('Umrah complete')}</h1>
      <dl class="summary">
        <dt>${t('Ihram')}</dt><dd>✓</dd>
        <dt>${t('Talbiyah')}</dt><dd>✓</dd>
        <dt>${t('Tawaf')}</dt><dd>${sum.tawafDone} / ${TAWAF_ROUNDS} ✓</dd>
        <dt>${t('Two rak’ahs')}</dt><dd>${s.two_rakah_at ? '✓' : '—'}</dd>
        <dt>${t('Zamzam')}</dt><dd>${s.zamzam_at ? '✓' : '—'}</dd>
        <dt>${t('Sa’i')}</dt><dd>${sum.saiDone} / ${SAI_LAPS} ✓</dd>
        <dt>${t('Hair')}</dt><dd>✓</dd>
      </dl>
      <p class="muted">${t('Started')}: ${fmtDateTime(s.started_at)}<br>${t('Completed')}: ${fmtDateTime(s.completed_at)}</p>
      <p>${t('Taqabbal Allāhu minnā wa minkum — may Allah accept it from us and from you.')}</p>
      <div class="grid-buttons">
        <a class="btn" href="#/journey">${t('View journey')}</a>
        <a class="btn" href="#/duas">${t('View duas')}</a>
        <a class="btn" href="#/guide/makkah">${t('Makkah guide')}</a>
        <a class="btn" href="#/guide/madinah">${t('Madinah guide')}</a>
      </div>
      <button class="btn ghost" data-action="new-umrah">${t('Start another Umrah')}</button>
    </section>`;
  },
};

// ───────────────────────── Correction modal ─────────────────────────

function modal(ctx) {
  if (ctx.ui.modal.kind === 'quick-confirm') return quickConfirmModal(ctx.ui.modal);
  const { ritual } = ctx.ui.modal;
  const s = ctx.state.session;
  if (!s) return '';
  const tawaf = ritual === 'tawaf';
  const total = tawaf ? TAWAF_ROUNDS : SAI_LAPS;
  const p = parseStage(s.current_stage);
  const current = p.kind === ritual ? p.n : null;
  return html`<div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="correct-title">
      <h2 id="correct-title">${t('Wrong count?')}</h2>
      <p>${t('Current')}: <b>${current ? (tawaf ? t('Round {n}', { n: current }) : t('Lap {n}', { n: current })) + ` / ${total}` : tawaf ? t('Tawaf complete') : t('Sa’i complete')}</b></p>
      <p>${tawaf ? t('Select the round you are on now:') : t('Select the lap you are on now:')}</p>
      <div class="picker">
        ${range(total).map((n) => html`<button class="btn ${n === current ? 'current' : ''}" data-action="correct" data-ritual="${ritual}" data-n="${n}">${n}${
          tawaf ? '' : html`<small>${place(saiDirection(n).from).slice(0, 1)}→${place(saiDirection(n).to).slice(0, 1)}</small>`
        }</button>`)}
      </div>
      ${tawaf ? '' : html`<p class="muted">${t('Odd laps go Safa → Marwah; even laps go Marwah → Safa.')}</p>`}
      <p class="alert info">${t('This app’s count is only a record to help you.')} <b>${t('Your own certain count is what matters.')}</b> ${t(G.DOUBT)}</p>
      <button class="btn ghost" data-action="close-modal">${t('Cancel')}</button>
    </div>
  </div>`;
}

function quickConfirmModal(m) {
  const tawaf = m.field === 'round';
  const question = tawaf
    ? t('Round {n} started only a few seconds ago. Mark it complete anyway?', { n: m.n })
    : t('Lap {n} started only a few seconds ago. Mark it complete anyway?', { n: m.n });
  const confirmLabel = tawaf ? t('Confirm Round {n} complete', { n: m.n }) : t('I have reached {place}', { place: place(saiDirection(m.n).to) });
  return html`<div class="modal-backdrop">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="quick-confirm-title">
      <h2 id="quick-confirm-title">${question}</h2>
      <button class="btn primary big" data-action="confirm-quick">✓ ${confirmLabel}</button>
      <button class="btn ghost" data-action="close-modal">${t('Cancel')}</button>
    </div>
  </div>`;
}

// ───────────────────────── Other pages ─────────────────────────

function prepPage(ctx) {
  const done = C.PREP_CHECKLIST.filter((i) => ctx.prefs.checklist[i.id]).length;
  return html`${pageHeader(t('Umrah preparation'), t('{done} / {total} ready', { done, total: C.PREP_CHECKLIST.length }))}
    <section class="card checks">
      ${C.PREP_CHECKLIST.map((i) => html`<label class="check">
        <input type="checkbox" data-action="prep-toggle" data-id="${i.id}" ${ctx.prefs.checklist[i.id] ? 'checked' : ''}>
        <span><b>${t(i.label)}</b>${i.link ? html`<a href="${i.link}">${t('Open')} →</a>` : ''}</span></label>`)}
    </section>
    <a class="btn primary" href="#/ihram">${t('Next: Understand Ihram')} →</a>`;
}

function ihramPage(ctx) {
  return html`${pageHeader(t('Understand Ihram'), t('What it is, how to enter it, what to wear, and what becomes forbidden.'))}
    <p>${reviewBadge(C.CONTENT_META.review)}</p>
    ${C.IHRAM_GUIDE.map((sec) => html`<section class="card"><h2>${t(sec.title)}</h2>${pointsList(sec.points)}</section>`)}
    ${duaCard(dua('intention'))}
    ${duaCard(dua('talbiyah'))}`;
}

function miqatPage(ctx) {
  const s = ctx.state.session;
  return html`${pageHeader(t('Miqat guide'), t(G.MIQAT.lead))}
    ${miqatPanel(ctx, s?.miqat?.route_id ?? ctx.prefs.miqatRoute)}
    ${pointsList(G.MIQAT.points)}
    <section class="card"><h2>${t('The five Miqats')}</h2>
      ${C.MIQATS.map((m) => html`<div class="miqat"><b>${m.name}</b> <span class="muted">— ${m.modern}</span><small>${t(m.forWho)} ${t('About {km} km from Makkah in a straight line.', { km: Math.round(miqatRadiusKm(m)) })}</small></div>`)}
    </section>`;
}

function duaContext(s) {
  if (!s || s.status !== 'active') return null;
  const p = parseStage(s.current_stage);
  if (p.kind === 'tawaf' || s.current_stage === STAGE.TAWAF_READY) return 'tawaf';
  if (p.kind === 'sai' || s.current_stage === STAGE.SAFA) return 'sai';
  if ([STAGE.TWO_RAKAH, STAGE.ZAMZAM, STAGE.TAWAF_COMPLETE].includes(s.current_stage)) return 'after-tawaf';
  if (s.current_stage === STAGE.ENTER_HARAM) return 'haram';
  if ([STAGE.MIQAT, STAGE.IHRAM, STAGE.TALBIYAH].includes(s.current_stage)) return 'ihram';
  return null;
}

function duasPage(ctx) {
  const s = ctx.state.session;
  const context = duaContext(s);
  const relevant = (d) => (context && d.contexts.includes(context) ? 1 : 0);
  return html`${pageHeader(t('Duas'), context ? t('What fits your current step is shown first.') : t('Arabic, recitation and meaning, with sources.'))}
    ${s?.status === 'active' ? html`<a class="btn" href="#/">← ${t('Back to')} ${stageName(s.current_stage)}</a>` : ''}
    <p class="alert info">${t(context === 'sai' ? C.SAI_DUA_NOTE : C.TAWAF_DUA_NOTE)}</p>
    <nav class="chips" aria-label="${t('Dua categories')}">
      ${C.DUA_CATEGORIES.map((c) => html`<button class="chip" data-action="scroll" data-target="dua-${c.id}">${c.icon} ${t(c.label)}</button>`)}
    </nav>
    ${C.DUA_CATEGORIES.map((cat) => {
      if (cat.id === 'personal') return personalDuas(ctx, cat);
      const items = C.DUAS.filter((d) => d.category === cat.id).sort((a, b) => relevant(b) - relevant(a));
      return html`<section id="dua-${cat.id}" class="dua-section">
        <h2>${cat.icon} ${t(cat.label)}</h2><p class="muted">${t(cat.intro)}</p>
        ${playAllButton(items.map((d) => d.id), t(cat.label))}
        ${items.map((d) => duaCard(d, { highlight: relevant(d) === 1 }))}
      </section>`;
    })}`;
}

function personalDuas(ctx, cat) {
  return html`<section id="dua-${cat.id}" class="dua-section">
    <h2>${cat.icon} ${t(cat.label)}</h2><p class="muted">${t(cat.intro)}</p>
    <ul class="personal">
      ${ctx.prefs.personalDuas.map((d) => html`<li><span>${d.text}</span><button class="btn small ghost" data-action="dua-remove" data-id="${d.id}" aria-label="${t('Remove')}">✕</button></li>`)}
    </ul>
    <form class="card" data-action="dua-add">
      <label class="field"><span>${t('Add a dua or a name to pray for')}</span><textarea name="text" rows="2" maxlength="500" required></textarea></label>
      <button class="btn" type="submit">${t('Add')}</button>
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
    offlineRow(t(g.label), g.cached, g.cached ? t('Saved on this device') : g.optional ? t('Partly saved') : t('Not downloaded yet')),
  );
  rows.push(offlineRow(t('Map'), true, t('Built into the app')));
  rows.push(offlineRow(t('Emergency information'), Boolean(info.emergencyPhone || info.leaderPhone), info.emergencyPhone || info.leaderPhone ? t('Saved on this device') : t('Add it in My info')));
  rows.push(offlineRow(t('Hotel information'), Boolean(info.hotelName || info.hotelLat), info.hotelName || info.hotelLat ? t('Saved on this device') : t('Add it in My info')));
  return html`${pageHeader(t('Umrah offline pack'), t('Download before you enter the Haram — mobile data is often unreliable inside.'))}
    ${o?.busy ? html`<p class="muted">${t('Checking…')}</p>` : ''}
    ${o?.error ? html`<p class="alert warn">${o.error}</p>` : ''}
    <ul class="offline-list">${rows}</ul>
    <button class="btn primary big" data-action="offline-download">⬇ ${t('Download / update offline pack')}</button>
    <p class="muted">${t('Your Umrah progress is saved on this device after every step. The ritual tracker never needs internet.')}</p>`;
}

function field(info, name, label, { type = 'text', textarea = false } = {}) {
  const v = info[name] ?? '';
  return html`<label class="field"><span>${label}</span>${
    textarea ? html`<textarea name="${name}" rows="3">${v}</textarea>` : html`<input name="${name}" type="${type}" value="${v}" autocomplete="off">`
  }</label>`;
}

function infoPage(ctx) {
  const i = ctx.prefs.info;
  const hasLoc = Number.isFinite(i.hotelLat) && Number.isFinite(i.hotelLng);
  return html`${pageHeader(t('My info & emergency'), t('Saved only on this device, available offline.'))}
    ${errorBox(ctx)}
    <form class="card" data-action="save-info">
      <h2>🏨 ${t('Hotel')}</h2>
      ${field(i, 'hotelName', t('Hotel name'))}
      ${field(i, 'hotelAddress', t('Address / directions'), { textarea: true })}
      ${field(i, 'hotelPhone', t('Hotel phone'), { type: 'tel' })}
      ${hasLoc
        ? html`<p>📍 ${t('Saved location')}: ${i.hotelLat.toFixed(5)}, ${i.hotelLng.toFixed(5)} ·
            <a href="https://www.google.com/maps/search/?api=1&query=${i.hotelLat},${i.hotelLng}" target="_blank" rel="noopener">${t('Open in maps')}</a> <small class="muted">(${t('needs internet')})</small></p>`
        : ''}
      <button type="button" class="btn" data-action="hotel-here">📍 ${t('Save my current location as the hotel')}</button>
      <h2>👥 ${t('Group')}</h2>
      ${field(i, 'groupName', t('Group / agency name'))}
      ${field(i, 'leaderName', t('Group leader'))}
      ${field(i, 'leaderPhone', t('Leader’s phone'), { type: 'tel' })}
      <h2>🆘 ${t('Emergency')}</h2>
      ${field(i, 'emergencyName', t('Emergency contact'))}
      ${field(i, 'emergencyPhone', t('Emergency contact phone'), { type: 'tel' })}
      ${field(i, 'medical', t('Medical notes (conditions, medication, allergies, blood type)'), { textarea: true })}
      <button class="btn primary big" type="submit">${t('Save on this device')}</button>
    </form>
    <section class="card">
      <h2>${t('Emergency numbers (Saudi Arabia)')}</h2>
      <ul class="call-list">
        ${C.EMERGENCY_NUMBERS.map((e) => html`<li><a class="btn" href="tel:${e.number}">📞 ${e.number}</a> ${t(e.label)}</li>`)}
        ${i.leaderPhone ? html`<li><a class="btn" href="tel:${i.leaderPhone}">📞 ${t('Leader')}</a> ${i.leaderName || t('Group leader')}</li>` : ''}
        ${i.emergencyPhone ? html`<li><a class="btn" href="tel:${i.emergencyPhone}">📞 ${t('Contact')}</a> ${i.emergencyName || t('Emergency contact')}</li>` : ''}
      </ul>
    </section>`;
}

const LOG_LABEL = {
  START: (e) => (e.gender === 'male' ? t('Umrah started (guidance for a man)') : t('Umrah started (guidance for a woman)')),
  NEXT: (e) => `→ ${stageName(e.stage)}`,
  TOGGLE_CHECK: (e) => t('Ihram check updated'),
  START_TAWAF: () => t('Tawaf started'),
  CONFIRM_TAWAF_ROUND: (e) => t('Tawaf round {n} confirmed', { n: e.round ?? '' }) + (e.confidence && e.confidence !== 'manual' ? ` (${t(CONFIDENCE_LABEL[e.confidence] ?? e.confidence)})` : ''),
  CORRECT_TAWAF_ROUND: (e) => t('Tawaf count corrected → now on round {n}', { n: e.round }),
  START_SAI: () => t('Sa’i started at Safa'),
  CONFIRM_SAI_LAP: (e) => t('Sa’i lap {n} confirmed', { n: e.lap ?? '' }) + (e.confidence && e.confidence !== 'manual' ? ` (${t(CONFIDENCE_LABEL[e.confidence] ?? e.confidence)})` : ''),
  CORRECT_SAI_LAP: (e) => t('Sa’i count corrected → now on lap {n}', { n: e.lap }),
  PAUSE: () => t('Paused'),
  RESUME: () => t('Resumed'),
  SET_TRACKING_MODE: (e) => (e.mode === 'assisted' ? t('Location help is ON') : t('Location help is OFF')),
  CONFIRM_HAIR: (e) => (e.method === 'shave' ? t('Hair: shaved') : t('Hair: shortened')),
  SET_MIQAT: () => t('Miqat route chosen'),
  RESET: () => t('Session ended'),
};

function journeyPage(ctx) {
  const sessions = [ctx.state.session, ...ctx.state.archive.slice().reverse()].filter(Boolean);
  if (!sessions.length) return html`${pageHeader(t('My journey'))}<p>${t('No journey yet. Start your Umrah from the Umrah tab.')}</p>`;
  const s = sessions.find((x) => x.id === ctx.route.arg) ?? sessions[0];
  const statusLabel = { active: 'In progress', complete: 'Complete', abandoned: 'Ended early' }[s.status];
  return html`${pageHeader(t('My journey'), `${fmtDateTime(s.started_at)} · ${t(statusLabel)}`)}
    ${sessions.length > 1
      ? html`<nav class="chips">${sessions.map((x) => html`<a class="chip ${x.id === s.id ? 'on' : ''}" href="#/journey/${x.id}">${fmtDateTime(x.started_at)}</a>`)}</nav>`
      : ''}
    <section class="card">
      <h2>${t('Summary')}</h2>
      <dl class="summary">
        <dt>${t('Current / last step')}</dt><dd>${stageName(s.current_stage)}</dd>
        <dt>${t('Tawaf')}</dt><dd>${summarize(s).tawafDone} / ${TAWAF_ROUNDS}</dd>
        <dt>${t('Sa’i')}</dt><dd>${summarize(s).saiDone} / ${SAI_LAPS}</dd>
        <dt>${t('Started')}</dt><dd>${fmtDateTime(s.started_at)}</dd>
        <dt>${t('Completed')}</dt><dd>${fmtDateTime(s.completed_at)}</dd>
      </dl>
      <p class="muted">${t('Times are an app record only — they are not a religious requirement.')}</p>
    </section>
    ${s.tawaf ? html`<section class="card"><h2>${t('Tawaf rounds')}</h2>${roundTable(s.tawaf.rounds, 'round_number', 'Round')}</section>` : ''}
    ${s.sai ? html`<section class="card"><h2>${t('Sa’i laps')}</h2>${roundTable(s.sai.laps, 'lap_number', 'Lap', true)}</section>` : ''}
    ${s.corrections.length
      ? html`<section class="card"><h2>${t('Count corrections')}</h2><ul>${s.corrections.map((c) => html`<li>${fmtTime(c.at)} — ${c.kind === 'tawaf' ? t('Tawaf') : t('Sa’i')}: ${c.from === 'complete' ? t('complete') : `#${c.from}`} → #${c.to}</li>`)}</ul></section>`
      : ''}
    ${details(ctx, 'journey:timeline', t('Timeline'), html`<ol class="timeline">${s.log.map((e) => html`<li><time>${fmtTime(e.at)}</time> ${(LOG_LABEL[e.type] ?? (() => e.type))(e)}</li>`)}</ol>`)}
    <div class="row">
      <button class="btn" data-action="export" data-id="${s.id}">⬇ ${t('Export journey (JSON)')}</button>
      ${s.status === 'active' ? html`<button class="btn danger" data-action="end-session">${t('End this session')}</button>` : ''}
    </div>`;
}

function roundTable(records, field, noun, withDirection = false) {
  if (!records.length) return html`<p class="muted">${t('None confirmed yet.')}</p>`;
  return html`<div class="table-wrap"><table>
    <thead><tr><th>${t(noun)}</th>${withDirection ? html`<th>${t('Direction')}</th>` : ''}<th>${t('Started')}</th><th>${t('Completed')}</th><th>${t('Recorded by')}</th></tr></thead>
    <tbody>${records.map((r) => html`<tr>
      <td>✓ ${r[field]}</td>
      ${withDirection ? html`<td>${place(r.start_location)} → ${place(r.end_location)}</td>` : ''}
      <td>${fmtTime(r.started_at)}</td><td>${fmtTime(r.completed_at)}</td>
      <td>${r.source === 'correction' ? t('Correction') : r.tracking_confidence === 'manual' ? t('Manual') : t('Location ({level})', { level: t(r.tracking_confidence) })}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

function guidePage(ctx) {
  const g = C.GUIDES[ctx.route.arg];
  if (!g) return html`${pageHeader(t('Guide not found'))}<a href="#/more">${t('Back')}</a>`;
  return html`${pageHeader(t(g.title))}
    <section class="card">${pointsList(g.points)}</section>
    <section class="card"><h2>${t('Coming later')}</h2>${pointsList(g.planned)}</section>`;
}

function aboutPage() {
  return html`${pageHeader(t('About this guide'))}
    <section class="card"><h2>${t('Content review status')}</h2>
      <p>${reviewBadge(C.CONTENT_META.review)} ${C.CONTENT_META.review.status === 'reviewed' ? t('Scholar-reviewed') : t('Pending scholar review')} · ${t('Version')} ${C.CONTENT_META.version}</p>
      <p>${t(C.CONTENT_META.note)}</p></section>
    <section class="card"><h2>${t('Your count is what counts')}</h2>
      <p>${t('The app keeps a record of your rounds and laps to help you. It is never an authority over your own count. If the app and your memory disagree, go with what you are certain of and correct the app.')}</p></section>
    <section class="card"><h2>${t('Location help')}</h2>
      <p>${t('Location can only suggest that a round or lap may be finished — it never marks one complete. The Kaaba, the start line, Maqām Ibrāhīm, Safa and Marwah are placed from OpenStreetMap survey data; the green-marker section of the Mas’a is approximate.')}</p></section>
    <section class="card"><h2>${t('Recitations')}</h2>
      <p>${t('Arabic is only ever played from real recitations: the Qur’anic verses from everyayah.com and the duas of the Sunnah from the Ḥiṣn al-Muslim recordings at hisnmuslim.com. The phone voice never reads Arabic.')}</p></section>
    <section class="card"><h2>${t('Privacy')}</h2>
      <p>${t('Your progress, notes and personal information stay on this device. Nothing is sent anywhere.')}</p></section>
    <p class="credit">${t('Designed and developed by Mhd Wasim')}</p>`;
}

function morePage(ctx) {
  const s = ctx.state.session;
  return html`${pageHeader(t('More'))}
    <section class="tiles">
      ${tile('#/language', '🌐', t('Language'), languageInfo().native)}
      ${tile('#/settings', '⚙️', t('Settings & voice'), '')}
      ${tile('#/info', '🆘', t('My info & emergency'), '')}
      ${tile('#/prep', '🧳', t('Preparation'), '')}
      ${tile('#/ihram', '🤍', t('Understand Ihram'), '')}
      ${tile('#/miqat', '📍', t('Miqat guide'), '')}
      ${tile('#/offline', '⬇️', t('Offline pack'), '')}
      ${tile('#/guide/makkah', '🕋', t('Makkah guide'), '')}
      ${tile('#/guide/madinah', '🕌', t('Madinah guide'), '')}
      ${tile('#/about', 'ℹ️', t('About & content review'), '')}
    </section>
    ${s?.status === 'active' ? html`<button class="btn danger" data-action="end-session">${t('End current Umrah session')}</button>` : ''}`;
}

function mapPage(ctx) {
  const m = ctx.ui.map;
  const s = ctx.state.session;
  const p = s ? parseStage(s.current_stage) : { kind: 'simple' };
  const r = ctx.ui.reading;
  return html`${pageHeader(t('Map'), t('Masjid al-Haram. Works offline.'))}
    ${m.error ? html`<p class="alert warn">${t(m.error)}</p>` : ''}
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
      <button class="btn ${m.live ? 'primary' : ''}" data-action="map-live">${m.live ? `⏹ ${t('Stop showing my location')}` : `📍 ${t('Show my location')}`}</button>
      ${m.trail.length ? html`<button class="btn" data-action="map-clear">${t('Clear trail')}</button>` : ''}
    </div>
    ${m.live
      ? m.distanceM != null && m.distanceM > MAP_RANGE_M
        ? html`<p class="alert warn">📍 ${t('You are about {km} km from Masjid al-Haram, so this close-up map cannot show your position — it only covers the mosque grounds. Come back here once you are near it.', { km: (m.distanceM / 1000).toFixed(1) })}</p>`
        : m.position
          ? html`<p class="tracking-line ok">📡 ${t('Live · accuracy about ±{m} m', { m: Math.round(m.accuracyM ?? 0) })}</p>`
          : html`<p class="tracking-line">📡 ${t('Waiting for a location fix…')}</p>`
      : ''}
    <section class="card"><h2>${t('What you are looking at')}</h2>
      <ul class="points">
        <li>${t('Kaaba, with the Black Stone corner and the START line to the green light: every Tawaf round begins and ends there.')}</li>
        <li>${t('Ḥijr Ismāʿīl: the semicircular wall. Walk outside it — it is part of the Kaaba.')}</li>
        <li>${t('Maqām Ibrāhīm: where the two rak’ahs after Tawaf are prayed if there is space.')}</li>
        <li>${t('Mas’a: Safa at the south end, Marwah at the north, with the green-marker section marked.')}</li>
      </ul>
      <p class="muted">${t('Positions come from OpenStreetMap survey data. For gates and services, follow the mosque’s own signs and staff.')}</p>
    </section>`;
}

function settingsPage(ctx) {
  const v = ctx.ui.voice;
  const s = ctx.state.session;
  const rec = ctx.ui.recitations;
  return html`${pageHeader(t('Settings'))}
    <section class="card">
      <h2>🌐 ${t('Language')}</h2>
      <p>${languageInfo().native}</p>
      <a class="btn" href="#/language">${t('Change language')}</a>
    </section>
    <section class="card">
      <h2>🔊 ${t('Voice guide')}</h2>
      <p class="muted">${t('Speaks every step, round and arrival in your language, using your phone’s voice. Works offline.')}</p>
      ${v.available
        ? html`<label class="check"><input type="checkbox" data-action="voice-toggle" ${v.enabled ? 'checked' : ''}>
            <span><b>${t('Voice guide')}</b><small>${t('The phone voice never reads Arabic — duas are played from real recitations.')}</small></span></label>
          ${(v.voices ?? []).length === 0
            ? html`<p class="alert warn">${t('Your phone has no {language} voice installed, so this will speak in English instead until you add it. To fix this, go to your phone’s Settings → Language & input → Text-to-speech output → Install voice data, and download {language}.', { language: languageInfo().native })}</p>`
            : v.voices.length > 1
              ? html`<label class="field"><span>${t('Voice')}</span>
                  <select data-action="voice-select">
                    <option value="" ${!v.voiceURI ? 'selected' : ''}>${t('Automatic (recommended)')}</option>
                    ${v.voices.map((opt) => html`<option value="${opt.uri}" ${opt.uri === v.voiceURI ? 'selected' : ''}>${opt.name}${opt.isDefault ? ` — ${t('suggested')}` : ''}</option>`)}
                  </select></label>
                  <p class="muted">${t('Not happy with how it sounds? Your phone may offer several voices for this language — try another one above.')}</p>`
              : html`<p class="muted">${t('Your phone only offers one voice for this language.')}</p>`}
          <button class="btn" data-action="voice-test">▶ ${t('Test the voice')}</button>`
        : html`<p class="alert warn">${t('This device or browser has no speech voice available.')}</p>`}
    </section>
    <section class="card">
      <h2>🎙 ${t('Recitations')}</h2>
      ${rec
        ? html`<p>${t('{n} recitations are on this device.', { n: Object.keys(rec.files ?? {}).length })}</p>
          <p>${t('Qur’anic verses recited by {name}.', { name: rec.quranReciter ?? rec.reciter })}</p>
          <p class="muted">${(rec.sources ?? []).join(' · ')}</p>
          ${rec.reciters && Object.keys(rec.reciters).length > 1
            ? html`<label class="field"><span>${t('Qur’an reciter')}</span>
                <select data-action="set-reciter">
                  <option value="" ${!ctx.prefs.reciter ? 'selected' : ''}>${t('Default ({name})', { name: rec.quranReciter })}</option>
                  ${Object.entries(rec.reciters).map(([key, name]) => html`<option value="${key}" ${key === ctx.prefs.reciter ? 'selected' : ''}>${name}</option>`)}
                </select></label>
                <p class="muted">${t('Applies to the 3 Qur’anic verses (Yemeni Corner, Maqām Ibrāhīm, Safa). The Sunnah duas are a single fixed recording each.')}</p>`
            : ''}`
        : html`<p class="muted">${t('No recitations on this device yet. They are included when the app is built.')}</p>`}
    </section>
    <section class="card">
      <h2>🔠 ${t('Text size')}</h2>
      <div class="row">
        <button class="btn ${!ctx.prefs.textScale || ctx.prefs.textScale === 1 ? 'primary' : ''}" data-action="set-text-size" data-scale="1">${t('Normal')}</button>
        <button class="btn ${ctx.prefs.textScale === 1.15 ? 'primary' : ''}" data-action="set-text-size" data-scale="1.15">${t('Large')}</button>
        <button class="btn ${ctx.prefs.textScale === 1.3 ? 'primary' : ''}" data-action="set-text-size" data-scale="1.3">${t('Extra large')}</button>
      </div>
    </section>
    <section class="card">
      <h2>📡 ${t('Counting')}</h2>
      ${s ? html`<p>${s.tracking_mode === 'assisted' ? t('Location help is ON') : t('Location help is OFF')}</p>` : ''}
      <ul class="offline-list">
        <li class="${ctx.ui.sensors.compass ? 'ok' : ''}"><span class="mark" aria-hidden="true">${ctx.ui.sensors.compass ? '✓' : '○'}</span>
          <span><b>${t('Compass')}</b><small>${ctx.ui.sensors.compass ? t('Working — it counts your turning when GPS is weak.') : t('Not seen yet. It starts when a round or lap does.')}</small></span></li>
        <li class="${ctx.ui.sensors.steps ? 'ok' : ''}"><span class="mark" aria-hidden="true">${ctx.ui.sensors.steps ? '✓' : '○'}</span>
          <span><b>${t('Step sensor')}</b><small>${ctx.ui.sensors.steps ? t('Working — it carries a Sa’i lap where GPS drops out.') : t('Not seen yet. It starts when a round or lap does.')}</small></span></li>
      </ul>
      <p><b>${t('Your step length:')}</b> ${ctx.ui.stepLengthM ? `${ctx.ui.stepLengthM.toFixed(2)} m` : t('not measured yet')}</p>
      ${ctx.ui.stepLengthM ? html`<button class="btn" data-action="reset-step-length">${t('Measure it again')}</button>` : ''}
    </section>`;
}
