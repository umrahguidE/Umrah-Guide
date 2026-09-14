import { html, raw, esc } from './html.js';
import { BASIS_LABEL } from '../data/content.js';
import { t } from '../i18n/index.js';

const f = (n) => n.toFixed(1);

// Recitations present on this device (audio/duas/index.json), set once per render.
let RECITATIONS = {};
let PLAYING = null;
export const setRecitations = (map, playingId = null) => {
  RECITATIONS = map ?? {};
  PLAYING = playingId;
};
export const hasRecitation = (id) => Boolean(RECITATIONS[id]);

export function progressBar(fraction, label) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100);
  return html`<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${label}"><span style="width:${pct}%"></span></div>`;
}

export function roundDots(completed, current, total) {
  return html`<ol class="dots" aria-label="${t('{done} of {total} completed', { done: completed, total })}">
    ${Array.from({ length: total }, (_, i) => {
      const n = i + 1;
      const cls = n <= completed ? 'done' : n === current ? 'current' : '';
      return html`<li class="${cls}">${n <= completed ? '✓' : n}</li>`;
    })}
  </ol>`;
}

export function reviewBadge(review) {
  return review?.status === 'reviewed'
    ? html`<span class="badge ok">${t('Scholar-reviewed')}</span>`
    : html`<span class="badge warn">${t('Pending scholar review')}</span>`;
}

/** Plays a real recitation when one exists; the phone voice never reads Arabic. */
export function listenButton(id, { big = false } = {}) {
  const recitation = RECITATIONS[id];
  if (!recitation) return '';
  const playing = PLAYING === id;
  return html`<button class="btn ${big ? 'primary' : 'small'} listen ${playing ? 'playing' : ''}" data-action="play-dua" data-id="${id}">
    ${playing ? `⏹ ${t('Stop')}` : `🎙 ${t('Listen to the recitation')}`}
  </button>`;
}

export function duaCard(d, { highlight = false, audio = true } = {}) {
  if (!d) return '';
  const recitation = audio ? RECITATIONS[d.id] : null;
  return html`<article class="dua ${highlight ? 'highlight' : ''}">
    <header><h3>${t(d.title)}</h3>${d.basis ? html`<span class="pill">${t(BASIS_LABEL[d.basis])}</span>` : ''}</header>
    ${d.when ? html`<p class="when">${t(d.when)}</p>` : ''}
    ${d.arabic ? html`<p class="arabic" lang="ar" dir="rtl">${d.arabic}</p>` : ''}
    ${audio ? listenButton(d.id) : ''}
    ${!audio
      ? ''
      : recitation
      ? html`<small class="reciter">${recitation.kind === 'quran' ? t('Recited by {name}', { name: recitation.reciter }) : t(recitation.reciter)} · ${recitation.label}${
          recitation.narration ? html`<br>${t('This recording reads the whole hadith, including the words of the dua.')}` : ''
        }</small>`
      : d.arabic
        ? html`<small class="muted">${t('No recitation recording for this dua yet.')}</small>`
        : ''}
    ${d.transliteration ? html`<p class="translit">${d.transliteration}</p>` : ''}
    ${d.translation ? html`<p class="translation">${t(d.translation)}</p>` : ''}
    ${d.note ? html`<p class="note">${t(d.note)}</p>` : ''}
    <footer>${d.source ? html`<span class="source">${t('Source')}: ${d.source}</span>` : ''}${reviewBadge(d.review)}</footer>
  </article>`;
}

/**
 * Tawaf ring seen from above, north up. The start line points at the Black
 * Stone corner; progress is drawn anticlockwise (Kaaba on the pilgrim's left).
 */
export function tawafRing({ progress = null, startBearing }) {
  const cx = 120;
  const cy = 120;
  const r = 92;
  const pt = (bearing, radius = r) => {
    const a = (bearing * Math.PI) / 180;
    return [cx + radius * Math.sin(a), cy - radius * Math.cos(a)];
  };
  const [sx, sy] = pt(startBearing);
  const [lx, ly] = pt(startBearing, r + 26);

  let arc = '';
  let dot = '';
  if (progress != null) {
    const p = Math.max(0, Math.min(1, progress));
    const [ex, ey] = pt(startBearing - p * 360);
    if (p >= 0.999) arc = `<circle cx="${cx}" cy="${cy}" r="${r}" class="ring-progress"/>`;
    else if (p > 0) arc = `<path class="ring-progress" d="M${f(sx)} ${f(sy)} A${r} ${r} 0 ${p > 0.5 ? 1 : 0} 0 ${f(ex)} ${f(ey)}"/>`;
    dot = `<circle class="pilgrim" cx="${f(ex)}" cy="${f(ey)}" r="8"/>`;
  }

  // Chevrons along the ring showing the anticlockwise direction of travel.
  const chevrons = [70, 160, 250]
    .map((offset) => {
      const b = startBearing - offset;
      const [x, y] = pt(b);
      return `<path class="chev" transform="rotate(${f(b - 90)} ${f(x)} ${f(y)})" d="M${f(x - 5)} ${f(y + 4)} L${f(x)} ${f(y - 5)} L${f(x + 5)} ${f(y + 4)}"/>`;
    })
    .join('');

  return raw(`<svg class="ring" viewBox="-34 -34 308 308" role="img" aria-label="${esc(t('Tawaf ring. Start at the Black Stone line; walk with the Kaaba on your left.'))}">
    <circle cx="${cx}" cy="${cy}" r="${r}" class="ring-track"/>
    ${arc}
    <g transform="rotate(${f(startBearing - 45)} ${cx} ${cy})">
      <rect x="98" y="98" width="44" height="44" rx="3" class="kaaba"/>
      <rect x="98" y="107" width="44" height="6" class="kaaba-band"/>
      <circle cx="142" cy="98" r="3.5" class="black-stone"/>
    </g>
    <line x1="${cx}" y1="${cy}" x2="${f(sx)}" y2="${f(sy)}" class="start-line"/>
    <circle cx="${f(sx)}" cy="${f(sy)}" r="9" class="start-dot"/>
    <text x="${f(lx)}" y="${f(ly)}" class="ring-label" text-anchor="middle" dominant-baseline="middle">${esc(t('START'))}</text>
    ${chevrons}
    ${dot}
  </svg>`);
}

/** Vertical Safa (top) to Marwah (bottom) track with the green-marker section. */
export function saiTrack({ direction, fromSafa = null, greenZone }) {
  const x = 60;
  const top = 36;
  const bottom = 264;
  const len = bottom - top;
  const y = (k) => top + k * len;
  const [g0, g1] = greenZone;
  const down = direction === 'SAFA_TO_MARWAH';
  const s = down ? 1 : -1;
  const chevrons = [0.1, 0.5, 0.8]
    .map((k) => `<path class="chev" d="M${x - 7} ${f(y(k) - 4 * s)} L${x} ${f(y(k) + 4 * s)} L${x + 7} ${f(y(k) - 4 * s)}"/>`)
    .join('');
  return raw(`<svg class="sai" viewBox="0 0 180 300" role="img" aria-label="${esc(down ? t('Safa to Marwah') : t('Marwah to Safa'))}">
    <rect x="${x - 15}" y="${f(y(g0))}" width="30" height="${f((g1 - g0) * len)}" rx="5" class="green-zone"/>
    <line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" class="sai-line"/>
    ${chevrons}
    <circle cx="${x}" cy="${top}" r="10" class="hill ${down ? 'from' : 'to'}"/>
    <text x="${x + 20}" y="${top + 5}" class="hill-label">${esc(t('SAFA'))}</text>
    <circle cx="${x}" cy="${bottom}" r="10" class="hill ${down ? 'to' : 'from'}"/>
    <text x="${x + 20}" y="${bottom + 5}" class="hill-label">${esc(t('MARWAH'))}</text>
    <text x="${x + 22}" y="${f(y((g0 + g1) / 2) + 4)}" class="green-label">${esc(t('green markers'))}</text>
    ${fromSafa != null ? `<circle cx="${x}" cy="${f(y(fromSafa))}" r="8" class="pilgrim"/>` : ''}
  </svg>`);
}
