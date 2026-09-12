// Offline map of Masjid al-Haram, drawn in metres around the Kaaba from the
// same coordinates the tracker uses, so the live position dot lands in the
// right place. Schematic: the mosque outline and distances are approximate
// until the site survey (README -> "Calibration").
import { toLocalM } from '../engine/geo.js';
import { HARAM_GEO } from '../engine/tracking.js';
import { raw } from './html.js';

const f = (n) => Number(n).toFixed(1);

/** Local metres (x east, y north) around the Kaaba's centre. */
export const localOf = (point) => toLocalM(HARAM_GEO.kaabaCenter, point);
export const SAFA = localOf(HARAM_GEO.safa);
export const MARWAH = localOf(HARAM_GEO.marwah);

// SVG y grows downwards, so north is -y.
const sx = (p) => p.x;
const sy = (p) => -p.y;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

function kaabaGroup(bearing) {
  // The Kaaba is about 12 x 11 m; its Black Stone corner points along `bearing`.
  return `<g transform="rotate(${f(bearing - 45)} 0 0)">
    <rect x="-6" y="-5.5" width="12" height="11" class="map-kaaba"/>
    <rect x="-6" y="-2.5" width="12" height="1.6" class="map-kaaba-band"/>
    <circle cx="6" cy="-5.5" r="1.6" class="map-black-stone"/>
  </g>`;
}

function hijrArc(bearing) {
  // Semicircular wall on the face between the ʿIrāqī and Shāmī corners.
  const a = (deg) => {
    const rad = ((bearing - deg) * Math.PI) / 180;
    return { x: 8.5 * Math.sin(rad), y: 8.5 * Math.cos(rad) };
  };
  const start = a(80);
  const end = a(190);
  return `<path class="map-hijr" d="M${f(sx(start))} ${f(sy(start))} A 10 10 0 0 0 ${f(sx(end))} ${f(sy(end))}"/>`;
}

function pointAt(bearing, metres) {
  const rad = (bearing * Math.PI) / 180;
  return { x: metres * Math.sin(rad), y: metres * Math.cos(rad) };
}

/**
 * @param {object} o
 * @param {{x:number,y:number}|null} o.pilgrim   live position in local metres
 * @param {number|null} o.accuracyM              accuracy circle around it
 * @param {Array} o.trail                        recent positions
 * @param {'tawaf'|'sai'|null} o.focus           which part to highlight
 * @param {number|null} o.saiFromSafa            0..1 along the Mas'a, when known
 */
export function haramMap({ pilgrim = null, accuracyM = null, trail = [], focus = null, saiFromSafa = null, geo = HARAM_GEO } = {}) {
  const b = geo.blackStoneBearingDeg;
  const startLine = pointAt(b, 78);
  const maqam = pointAt(b - 45, 13);
  const [g0, g1] = geo.greenZone;
  const greenA = lerp(SAFA, MARWAH, g0);
  const greenB = lerp(SAFA, MARWAH, g1);
  const masaAngle = (Math.atan2(MARWAH.x - SAFA.x, MARWAH.y - SAFA.y) * 180) / Math.PI;
  const masaLength = Math.hypot(MARWAH.x - SAFA.x, MARWAH.y - SAFA.y);
  const saiDot = saiFromSafa == null ? null : lerp(SAFA, MARWAH, saiFromSafa);

  const trailPath = trail.length > 1 ? `<polyline class="map-trail" points="${trail.map((p) => `${f(sx(p))},${f(sy(p))}`).join(' ')}"/>` : '';
  const pilgrimDot = pilgrim
    ? `${accuracyM ? `<circle class="map-accuracy" cx="${f(sx(pilgrim))}" cy="${f(sy(pilgrim))}" r="${f(Math.max(4, accuracyM))}"/>` : ''}
       <circle class="map-pilgrim" cx="${f(sx(pilgrim))}" cy="${f(sy(pilgrim))}" r="6"/>`
    : '';

  return raw(`<svg class="map ${focus ? `focus-${focus}` : ''}" viewBox="-165 -375 390 545" role="img"
    aria-label="Map of Masjid al-Haram showing the Kaaba, the Mataf, the Black Stone line and the Mas'a between Safa and Marwah">
    <rect x="-160" y="-370" width="380" height="535" rx="30" class="map-ground"/>
    <rect x="-150" y="-352" width="300" height="518" rx="42" class="map-mosque"/>

    <g class="map-masa-group">
      <g transform="translate(${f(sx(SAFA))} ${f(sy(SAFA))}) rotate(${f(masaAngle)})">
        <rect x="-11" y="${f(-masaLength)}" width="22" height="${f(masaLength)}" rx="6" class="map-masa"/>
      </g>
      <line class="map-green" x1="${f(sx(greenA))}" y1="${f(sy(greenA))}" x2="${f(sx(greenB))}" y2="${f(sy(greenB))}"/>
      <circle class="map-hill" cx="${f(sx(SAFA))}" cy="${f(sy(SAFA))}" r="9"/>
      <text class="map-label" x="${f(sx(SAFA) + 16)}" y="${f(sy(SAFA) + 5)}">SAFA</text>
      <circle class="map-hill" cx="${f(sx(MARWAH))}" cy="${f(sy(MARWAH))}" r="9"/>
      <text class="map-label" x="${f(sx(MARWAH) + 16)}" y="${f(sy(MARWAH) + 5)}">MARWAH</text>
      <text class="map-note" x="${f(sx(lerp(greenA, greenB, 0.5)) + 16)}" y="${f(sy(lerp(greenA, greenB, 0.5)))}">green markers</text>
    </g>

    <g class="map-mataf-group">
      <circle cx="0" cy="0" r="60" class="map-mataf"/>
      <circle cx="0" cy="0" r="95" class="map-mataf-outer"/>
      <line class="map-start-line" x1="0" y1="0" x2="${f(sx(startLine))}" y2="${f(sy(startLine))}"/>
      <circle class="map-start" cx="${f(sx(startLine))}" cy="${f(sy(startLine))}" r="7"/>
      <text class="map-label" x="${f(sx(startLine) + 12)}" y="${f(sy(startLine) + 4)}">START</text>
      ${hijrArc(b)}
      ${kaabaGroup(b)}
      <circle class="map-maqam" cx="${f(sx(maqam))}" cy="${f(sy(maqam))}" r="4"/>
      <text class="map-note" x="${f(sx(maqam) + 8)}" y="${f(sy(maqam) - 6)}">Maqām Ibrāhīm</text>
    </g>

    ${trailPath}
    ${saiDot && !pilgrim ? `<circle class="map-pilgrim" cx="${f(sx(saiDot))}" cy="${f(sy(saiDot))}" r="6"/>` : ''}
    ${pilgrimDot}

    <g class="map-chrome">
      <path class="map-north" d="M-140 -330 L-134 -314 L-140 -318 L-146 -314 Z"/>
      <text class="map-note" x="-140" y="-300" text-anchor="middle">N</text>
      <line class="map-scale" x1="-140" y1="140" x2="-90" y2="140"/>
      <text class="map-note" x="-140" y="132">50 m</text>
    </g>
  </svg>`);
}

/** Keeps the last positions for the map trail. */
export function createTrail(limit = 120) {
  const points = [];
  return {
    add(point) {
      const last = points.at(-1);
      if (point && (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1.5)) {
        points.push({ x: point.x, y: point.y });
        if (points.length > limit) points.shift();
      }
      return points;
    },
    clear() {
      points.length = 0;
    },
    get points() {
      return points;
    },
  };
}
