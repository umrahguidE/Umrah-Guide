/**
 * What the voice guide says out loud. Short, plain sentences — a spoken version
 * of what is already on screen, so it carries the same draft status and goes
 * through the same scholar review.
 *
 * Transliterations are spelled the way a speech engine pronounces them best
 * ("rak-ahs", "Sa-i"), not the way they are written on screen.
 */
import { PLACE_LABEL, parseStage, saiDirection, TAWAF_ROUNDS, SAI_LAPS } from '../engine/stages.js';

export const STAGE_LINES = {
  MIQAT: 'Approaching the Miqat. Get ready to enter Ihram.',
  IHRAM: 'Ihram check. Confirm you are prepared, that you have made the intention, and that you have begun the Talbiyah.',
  TALBIYAH: 'Recite the Talbiyah often, until you begin Tawaf.',
  ENTER_HARAM: 'You are at Masjid al Haram. Next is Tawaf. Make wudu, and keep the Kaaba on your left.',
  TAWAF_READY: 'Go to the Black Stone line. Every round starts and ends here. Stop the Talbiyah when Tawaf begins.',
  TAWAF_COMPLETE: 'Tawaf complete. Seven rounds. Next, pray two rak-ahs.',
  TWO_RAKAH: 'Pray two rak-ahs. Behind Maqam Ibrahim if there is space, otherwise anywhere in the mosque.',
  ZAMZAM: 'Drink Zamzam if it is available, and make your own dua.',
  SAFA: 'Sa-i starts at Safa, not Marwah. Face the Kaaba, then begin lap one towards Marwah.',
  SAI_COMPLETE: 'Sa-i complete. Seven laps, ending at Marwah. Next is the hair.',
  HAIR: 'The final step. Shave or shorten the hair for men. Shorten for women.',
  IHRAM_EXIT: 'The Ihram restrictions have now ended.',
  UMRAH_COMPLETE: 'Your Umrah is complete. Al hamdu lillah.',
};

export function stageLine(stage, session) {
  const p = parseStage(stage);
  if (p.kind === 'tawaf') {
    const last = p.n === TAWAF_ROUNDS ? ' This is the final round.' : '';
    return `Round ${p.n} of ${TAWAF_ROUNDS}. Keep the Kaaba on your left.${last}`;
  }
  if (p.kind === 'sai') {
    const d = saiDirection(p.n);
    const last = p.n === SAI_LAPS ? ' This is the final lap. It ends at Marwah.' : '';
    return `Lap ${p.n} of ${SAI_LAPS}. ${PLACE_LABEL[d.from]} to ${PLACE_LABEL[d.to]}.${last}`;
  }
  if (stage === 'IHRAM' && session?.gender === 'female') return `${STAGE_LINES.IHRAM} Women recite the Talbiyah quietly.`;
  return STAGE_LINES[stage] ?? null;
}

export const roundConfirmed = (n) =>
  n >= TAWAF_ROUNDS ? 'Round seven confirmed. Tawaf complete.' : `Round ${n} confirmed. ${TAWAF_ROUNDS - n} to go. Begin round ${n + 1}.`;

export function lapConfirmed(n) {
  if (n >= SAI_LAPS) return 'Lap seven confirmed at Marwah. Sa-i complete.';
  const next = saiDirection(n + 1);
  return `Lap ${n} confirmed at ${PLACE_LABEL[saiDirection(n).to]}. ${SAI_LAPS - n} to go. Now ${PLACE_LABEL[next.from]} to ${PLACE_LABEL[next.to]}.`;
}

export const TAWAF_SUGGESTION = 'You appear to be back at the Black Stone line. Confirm the round if you have completed it.';
export const saiSuggestion = (place) => `You appear to have reached ${PLACE_LABEL[place]}. Confirm when you have arrived.`;

export const sectorLine = (sector) => (sector?.tip ? `${sector.label}. ${sector.tip}` : (sector?.label ?? null));

export const greenMarkers = (gender) =>
  gender === 'male' ? 'Green markers. Jog between them if you are able.' : 'Green markers. Keep walking at your normal pace.';

export const WEAK_SIGNAL = 'Tracking signal is weak. Please keep count yourself, and confirm each round by hand.';
export const PAUSED = 'Tracking paused.';
export const RESUMED = 'Tracking resumed.';
export const corrected = (kind, n) => `${kind === 'tawaf' ? 'Round' : 'Lap'} count corrected. You are now on ${kind === 'tawaf' ? 'round' : 'lap'} ${n}.`;

export const miqatApproaching = (km, name) => `Miqat approaching. About ${Math.round(km)} kilometres to the line of ${name}. Enter Ihram now if you have not.`;
export const miqatReached = (name) => `You have reached the ${name} Miqat line. You should be in Ihram now.`;

/** Spoken introduction for a dua card when there is no recorded recitation. */
export const duaIntro = (dua) => `${dua.title}. ${dua.translation ?? dua.note ?? ''}`.trim();
