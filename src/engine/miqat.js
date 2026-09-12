import { distanceM } from './geo.js';

export const MAKKAH = Object.freeze({ lat: 21.422487, lng: 39.826206 });
export const APPROACH_ALERT_KM = 150;

export const miqatRadiusKm = (miqat) => distanceM(miqat.coords, MAKKAH) / 1000;

/**
 * Route-aware Miqat check. Each Miqat is treated as a ring around Makkah at its
 * own distance ("passing parallel to the Miqat"). The boundary reached first is
 * the one that applies, so candidates are sorted by distance still to travel.
 * This is an approximation for alerts only — crew announcements and the
 * pilgrim's scholar take priority.
 */
export function miqatStatus(position, miqats) {
  if (!miqats.length) throw new Error('No Miqat to compare against.');
  const distanceToMakkahKm = distanceM(position, MAKKAH) / 1000;
  const candidates = miqats
    .map((m) => {
      const radiusKm = miqatRadiusKm(m);
      return { id: m.id, name: m.name, radiusKm, kmToBoundary: distanceToMakkahKm - radiusKm };
    })
    .sort((a, b) => a.kmToBoundary - b.kmToBoundary);
  const first = candidates[0];
  const status = first.kmToBoundary <= 0 ? 'reached' : first.kmToBoundary <= APPROACH_ALERT_KM ? 'approaching' : 'far';
  return { distanceToMakkahKm, status, first, candidates };
}
