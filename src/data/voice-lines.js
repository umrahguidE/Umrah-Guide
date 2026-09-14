/**
 * What the voice guide says out loud, in the pilgrim's language. Short, plain
 * sentences — a spoken version of what is already on screen, so it carries the
 * same draft status and goes through the same review.
 *
 * The English is written for the speech engine ("rak-ahs", "Sa-i"). Arabic
 * duas are never spoken by the phone voice: only real recitations play Arabic.
 */
import { PLACE_LABEL, parseStage, saiDirection, TAWAF_ROUNDS, SAI_LAPS } from '../engine/stages.js';
import { t } from '../i18n/index.js';

export const STAGE_LINES = {
  MIQAT: 'Approaching the Miqat. Get ready to enter Ihram.',
  IHRAM: 'Ihram check. Confirm you are prepared, that you have made the intention, and that you have begun the Talbiyah.',
  TALBIYAH: 'Recite the Talbiyah often, until you begin Tawaf.',
  ENTER_HARAM: 'You are at Masjid al Haram. Next is Tawaf. Keep the Kaaba on your left.',
  TAWAF_READY: 'Go to the Black Stone line. Check that you have wudu. Every round starts and ends at this line.',
  TAWAF_COMPLETE: 'Tawaf complete. Seven rounds. Next, pray two rak-ahs.',
  TWO_RAKAH: 'Pray two rak-ahs. Behind Maqam Ibrahim if there is space, otherwise anywhere in the mosque.',
  ZAMZAM: 'Drink Zamzam if it is available, and make your own dua.',
  SAFA: 'Sa-i starts at Safa, not Marwah. Face the Kaaba, then begin lap one towards Marwah.',
  SAI_COMPLETE: 'Sa-i complete. Seven laps, ending at Marwah. Next is the hair.',
  HAIR: 'The final step. Shave or shorten the hair for men. Shorten for women.',
  IHRAM_EXIT: 'The Ihram restrictions have now ended.',
  UMRAH_COMPLETE: 'Your Umrah is complete. Al hamdu lillah.',
};

const place = (id) => t(PLACE_LABEL[id]);

export function stageLine(stage, session) {
  const p = parseStage(stage);
  if (p.kind === 'tawaf') {
    const line = t('Round {n} of {total}. Keep the Kaaba on your left.', { n: p.n, total: TAWAF_ROUNDS });
    return p.n === TAWAF_ROUNDS ? `${line} ${t('This is the final round.')}` : line;
  }
  if (p.kind === 'sai') {
    const d = saiDirection(p.n);
    const line = t('Lap {n} of {total}. {from} to {to}.', { n: p.n, total: SAI_LAPS, from: place(d.from), to: place(d.to) });
    return p.n === SAI_LAPS ? `${line} ${t('This is the final lap. It ends at Marwah.')}` : line;
  }
  if (!STAGE_LINES[stage]) return null;
  const line = t(STAGE_LINES[stage]);
  return stage === 'IHRAM' && session?.gender === 'female' ? `${line} ${t('Women recite the Talbiyah quietly.')}` : line;
}

export const roundConfirmed = (n) =>
  n >= TAWAF_ROUNDS
    ? t('Round seven confirmed. Tawaf complete.')
    : t('Round {n} confirmed. {left} to go. Begin round {next}.', { n, left: TAWAF_ROUNDS - n, next: n + 1 });

export function lapConfirmed(n) {
  if (n >= SAI_LAPS) return t('Lap seven confirmed at Marwah. Sa-i complete.');
  const next = saiDirection(n + 1);
  return t('Lap {n} confirmed at {at}. {left} to go. Now {from} to {to}.', {
    n,
    at: place(saiDirection(n).to),
    left: SAI_LAPS - n,
    from: place(next.from),
    to: place(next.to),
  });
}

export const tawafSuggestion = () => t('You appear to be back at the Black Stone line. Confirm the round if you have completed it.');
export const saiSuggestion = (to) => t('You appear to have reached {place}. Confirm when you have arrived.', { place: place(to) });

export const sectorLine = (sector) => (sector ? [t(sector.label), t(sector.tip)].filter(Boolean).join('. ') : null);

export const greenMarkers = (gender) =>
  gender === 'male' ? t('Green markers. Jog between them if you are able.') : t('Green markers. Keep walking at your normal pace.');

export const weakSignal = () => t('Tracking signal is weak. Please keep count yourself, and confirm each round by hand.');
export const paused = () => t('Tracking paused.');
export const resumed = () => t('Tracking resumed.');
export const corrected = (kind, n) =>
  kind === 'tawaf' ? t('Round count corrected. You are now on round {n}.', { n }) : t('Lap count corrected. You are now on lap {n}.', { n });

export const miqatApproaching = (km, name) =>
  t('Miqat approaching. About {km} kilometres to the line of {name}. Enter Ihram now if you have not.', { km: Math.round(km), name });
export const miqatReached = (name) => t('You have reached the {name} Miqat line. You should be in Ihram now.', { name });

// Kept for the content review sheet, which lists every spoken line in English.
export const TAWAF_SUGGESTION = 'You appear to be back at the Black Stone line. Confirm the round if you have completed it.';
export const WEAK_SIGNAL = 'Tracking signal is weak. Please keep count yourself, and confirm each round by hand.';
