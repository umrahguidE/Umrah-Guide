// The Umrah ritual as one ordered list of stages. Counted rituals (Tawaf rounds,
// Sa'i laps) are expanded into one stage per round, so the journey is a single
// linear state machine: the current stage alone says where the pilgrim is.

export const TAWAF_ROUNDS = 7;
export const SAI_LAPS = 7;

export const STAGE = Object.freeze({
  NOT_STARTED: 'UMRAH_NOT_STARTED',
  MIQAT: 'MIQAT',
  IHRAM: 'IHRAM',
  TALBIYAH: 'TALBIYAH',
  ENTER_HARAM: 'ENTER_HARAM',
  TAWAF_READY: 'TAWAF_READY',
  TAWAF_COMPLETE: 'TAWAF_COMPLETE',
  TWO_RAKAH: 'TWO_RAKAH',
  ZAMZAM: 'ZAMZAM',
  SAFA: 'SAFA',
  SAI_COMPLETE: 'SAI_COMPLETE',
  HAIR: 'HAIR',
  IHRAM_EXIT: 'IHRAM_EXIT',
  UMRAH_COMPLETE: 'UMRAH_COMPLETE',
});

export const tawafRoundStage = (n) => `TAWAF_ROUND_${n}`;
export const saiLapStage = (n) => `SAI_${n}`;

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);

export const STAGE_ORDER = Object.freeze([
  STAGE.NOT_STARTED,
  STAGE.MIQAT,
  STAGE.IHRAM,
  STAGE.TALBIYAH,
  STAGE.ENTER_HARAM,
  STAGE.TAWAF_READY,
  ...range(TAWAF_ROUNDS).map(tawafRoundStage),
  STAGE.TAWAF_COMPLETE,
  STAGE.TWO_RAKAH,
  STAGE.ZAMZAM,
  STAGE.SAFA,
  ...range(SAI_LAPS).map(saiLapStage),
  STAGE.SAI_COMPLETE,
  STAGE.HAIR,
  STAGE.IHRAM_EXIT,
  STAGE.UMRAH_COMPLETE,
]);

const STAGE_LABEL = {
  [STAGE.NOT_STARTED]: 'Not started',
  [STAGE.MIQAT]: 'Miqat',
  [STAGE.IHRAM]: 'Ihram',
  [STAGE.TALBIYAH]: 'Talbiyah',
  [STAGE.ENTER_HARAM]: 'Masjid al-Haram',
  [STAGE.TAWAF_READY]: 'Tawaf — starting point',
  [STAGE.TAWAF_COMPLETE]: 'Tawaf complete',
  [STAGE.TWO_RAKAH]: 'Two rak’ahs',
  [STAGE.ZAMZAM]: 'Zamzam',
  [STAGE.SAFA]: 'Sa’i — Safa',
  [STAGE.SAI_COMPLETE]: 'Sa’i complete',
  [STAGE.HAIR]: 'Hair',
  [STAGE.IHRAM_EXIT]: 'Exit Ihram',
  [STAGE.UMRAH_COMPLETE]: 'Umrah complete',
};

export function parseStage(id) {
  let m = /^TAWAF_ROUND_(\d+)$/.exec(id ?? '');
  if (m && +m[1] >= 1 && +m[1] <= TAWAF_ROUNDS) return { kind: 'tawaf', n: Number(m[1]) };
  m = /^SAI_(\d+)$/.exec(id ?? '');
  if (m && +m[1] >= 1 && +m[1] <= SAI_LAPS) return { kind: 'sai', n: Number(m[1]) };
  return { kind: 'simple', n: null };
}

export const PLACE = Object.freeze({ SAFA: 'SAFA', MARWAH: 'MARWAH' });
export const PLACE_LABEL = Object.freeze({ SAFA: 'Safa', MARWAH: 'Marwah' });

// Lap 1 is Safa -> Marwah. Odd laps end at Marwah, even laps at Safa, so lap 7 ends at Marwah.
export function saiDirection(lap) {
  const outbound = lap % 2 === 1;
  const from = outbound ? PLACE.SAFA : PLACE.MARWAH;
  const to = outbound ? PLACE.MARWAH : PLACE.SAFA;
  return { from, to, key: `${from}_TO_${to}` };
}

export const stageIndex = (id) => STAGE_ORDER.indexOf(id);

export function stageTitle(id) {
  const p = parseStage(id);
  if (p.kind === 'tawaf') return `Tawaf — Round ${p.n} / ${TAWAF_ROUNDS}`;
  if (p.kind === 'sai') return `Sa’i — Lap ${p.n} / ${SAI_LAPS}`;
  return STAGE_LABEL[id] ?? id;
}

// Ihram restrictions apply once the Ihram check is done and last until the hair ritual.
export function isIhramActive(id) {
  const i = stageIndex(id);
  return i >= stageIndex(STAGE.TALBIYAH) && i <= stageIndex(STAGE.HAIR);
}

// Rounds and laps weigh more than single steps so the overall bar moves the way the effort does.
const weight = (id) => (parseStage(id).kind === 'simple' ? 1 : 2);
const JOURNEY = STAGE_ORDER.slice(1, -1);
const TOTAL_WEIGHT = JOURNEY.reduce((sum, id) => sum + weight(id), 0);

/** Share of the journey finished before reaching `id`, from 0 to 1. */
export function progressOf(id) {
  if (id === STAGE.UMRAH_COMPLETE) return 1;
  const i = JOURNEY.indexOf(id);
  if (i < 0) return 0;
  return JOURNEY.slice(0, i).reduce((sum, s) => sum + weight(s), 0) / TOTAL_WEIGHT;
}
