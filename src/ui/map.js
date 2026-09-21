// Offline map of Masjid al-Haram, drawn in metres around the Kaaba from the
// mapped geometry in HARAM_GEO (OpenStreetMap): the Kaaba's real corners, the
// Tawaf start line to the green light, Maqām Ibrāhīm, Ḥijr Ismāʿīl, and the
// Mas'a between the Safa and Marwah hilltops. The mosque outline and the
// green-marker section are schematic.
import { toLocalM } from '../engine/geo.js';
import { HARAM_GEO } from '../engine/tracking.js';
import { raw, esc } from './html.js';
import { t } from '../i18n/index.js';

const f = (n) => Number(n).toFixed(1);

/** Local metres (x east, y north) around the Kaaba's centre. */
export const localOf = (point) => toLocalM(HARAM_GEO.kaabaCenter, point);
export const SAFA = localOf(HARAM_GEO.safa);
export const MARWAH = localOf(HARAM_GEO.marwah);

// SVG y grows downwards, so north is -y.
const sx = (p) => p.x;
const sy = (p) => -p.y;
const pt = (p) => `${f(sx(p))},${f(sy(p))}`;
const lerp = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });

/**
 * @param {object} o
 * @param {{x:number,y:number}|null} o.pilgrim   live position in local metres
 * @param {number|null} o.accuracyM              accuracy circle around it
 * @param {Array} o.trail                        recent positions
 * @param {'tawaf'|'sai'|null} o.focus           which part to highlight
 * @param {number|null} o.saiFromSafa            0..1 along the Mas'a, when known
 */
export function haramMap({ pilgrim = null, accuracyM = null, trail = [], focus = null, saiFromSafa = null, geo = HARAM_GEO } = {}) {
  const corners = geo.kaabaCorners;
  const kaaba = [corners.blackStone, corners.iraqi, corners.shami, corners.yemeni].map(localOf);
  const blackStone = kaaba[0];
  const startLine = geo.startLine.map(localOf);
  const greenLight = startLine.at(-1);
  const maqam = localOf(geo.maqam);
  const hijr = geo.hijr.map(localOf);
  const [g0, g1] = geo.greenZone;
  const greenA = lerp(SAFA, MARWAH, g0);
  const greenB = lerp(SAFA, MARWAH, g1);
  const masaAngle = (Math.atan2(MARWAH.x - SAFA.x, MARWAH.y - SAFA.y) * 180) / Math.PI;
  const masaLength = Math.hypot(MARWAH.x - SAFA.x, MARWAH.y - SAFA.y);
  const saiDot = saiFromSafa == null ? null : lerp(SAFA, MARWAH, saiFromSafa);

  const trailPath = trail.length > 1 ? `<polyline class="map-trail" points="${trail.map(pt).join(' ')}"/>` : '';
  const pilgrimDot = pilgrim
    ? `${accuracyM ? `<circle class="map-accuracy" cx="${f(sx(pilgrim))}" cy="${f(sy(pilgrim))}" r="${f(Math.max(4, accuracyM))}"/>` : ''}
       <circle class="map-pilgrim-pulse" cx="${f(sx(pilgrim))}" cy="${f(sy(pilgrim))}" r="6"/>
       <circle class="map-pilgrim" cx="${f(sx(pilgrim))}" cy="${f(sy(pilgrim))}" r="6"/>`
    : '';
  const label = (key) => esc(t(key));

  return raw(`<svg class="map ${focus ? `focus-${focus}` : ''}" viewBox="-165 -375 390 545" role="img" aria-label="${label('Map of Masjid al-Haram')}">
    <rect x="-160" y="-370" width="380" height="535" rx="30" class="map-ground"/>
    <rect x="-150" y="-352" width="300" height="518" rx="42" class="map-mosque"/>

    <g class="map-masa-group">
      <g transform="translate(${f(sx(SAFA))} ${f(sy(SAFA))}) rotate(${f(masaAngle)})">
        <rect x="-11" y="${f(-masaLength)}" width="22" height="${f(masaLength)}" rx="6" class="map-masa"/>
      </g>
      <line class="map-green" x1="${f(sx(greenA))}" y1="${f(sy(greenA))}" x2="${f(sx(greenB))}" y2="${f(sy(greenB))}"/>
      <circle class="map-hill" cx="${f(sx(SAFA))}" cy="${f(sy(SAFA))}" r="9"/>
      <text class="map-label" x="${f(sx(SAFA) + 16)}" y="${f(sy(SAFA) + 5)}">${label('SAFA')}</text>
      <circle class="map-hill" cx="${f(sx(MARWAH))}" cy="${f(sy(MARWAH))}" r="9"/>
      <text class="map-label" x="${f(sx(MARWAH) - 16)}" y="${f(sy(MARWAH) + 5)}" text-anchor="end">${label('MARWAH')}</text>
      <text class="map-note" x="${f(sx(lerp(greenA, greenB, 0.5)) + 16)}" y="${f(sy(lerp(greenA, greenB, 0.5)))}">${label('green markers')}</text>
    </g>

    <g class="map-mataf-group">
      <circle cx="0" cy="0" r="45" class="map-mataf"/>
      <circle cx="0" cy="0" r="80" class="map-mataf-outer"/>
      <polyline class="map-start-line" points="${startLine.map(pt).join(' ')}"/>
      <circle class="map-start" cx="${f(sx(greenLight))}" cy="${f(sy(greenLight))}" r="6"/>
      <text class="map-label" x="${f(sx(greenLight) + 10)}" y="${f(sy(greenLight) + 16)}">${label('START')}</text>
      <polygon class="map-hijr-fill" points="${hijr.map(pt).join(' ')}"/>
      <polygon class="map-kaaba" points="${kaaba.map(pt).join(' ')}"/>
      <circle class="map-black-stone" cx="${f(sx(blackStone))}" cy="${f(sy(blackStone))}" r="1.8"/>
      <circle class="map-maqam" cx="${f(sx(maqam))}" cy="${f(sy(maqam))}" r="2.5"/>
      <text class="map-note" x="${f(sx(maqam) + 6)}" y="${f(sy(maqam) - 8)}">${label('Maqām Ibrāhīm')}</text>
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
