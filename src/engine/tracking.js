import { normDeg, toLocalM } from './geo.js';

/**
 * Site geometry from OpenStreetMap (© OpenStreetMap contributors, ODbL),
 * retrieved 2026-09-14:
 *  - Kaaba outline with named corners ........ way 103914569
 *  - marked Tawaf start/end line ............. way 671147142 (Black Stone → green light)
 *  - Maqām Ibrāhīm ........................... way 473301379
 *  - Ḥijr Ismāʿīl ............................ way 315911894
 *  - Safa and Marwah hilltops ................ nodes 4589923995, 4589923996
 * Mapped features can still be a few metres out; confirm on site before release.
 * The green-marker section of the Mas'a is NOT mapped: its position is approximate.
 */
export const HARAM_GEO = Object.freeze({
  kaabaCenter: { lat: 21.4225171, lng: 39.8261825 },
  kaabaCorners: Object.freeze({
    blackStone: { lat: 21.4224985, lng: 39.8262546 },
    iraqi: { lat: 21.4225861, lng: 39.8261922 },
    shami: { lat: 21.4225371, lng: 39.8261095 },
    yemeni: { lat: 21.4224468, lng: 39.8261735 },
  }),
  // The start line is drawn on the Mataf floor from the Black Stone to the green light on the wall.
  startLine: Object.freeze([
    { lat: 21.4224985, lng: 39.8262546 },
    { lat: 21.4224083, lng: 39.8265193 },
    { lat: 21.4222904, lng: 39.8268401 },
  ]),
  // Bearing of that line seen from the Kaaba's centre, where pilgrims cross it (20–80 m out).
  blackStoneBearingDeg: 110,
  maqam: { lat: 21.4225789, lng: 39.8263055 },
  hijr: Object.freeze([
    [21.422607, 39.8261737], [21.4226204, 39.8261664], [21.4226305, 39.8261545], [21.422636, 39.8261395],
    [21.4226362, 39.8261234], [21.4226311, 39.8261083], [21.4226209, 39.8260957], [21.4226071, 39.826088],
    [21.4225916, 39.8260862], [21.4225766, 39.8260907], [21.4225642, 39.8261007], [21.4225575, 39.8260911],
    [21.4225716, 39.8260797], [21.4225907, 39.826074], [21.4226104, 39.8260763], [21.4226279, 39.8260861],
    [21.4226409, 39.8261021], [21.4226474, 39.8261214], [21.4226471, 39.8261419], [21.4226401, 39.8261609],
    [21.4226273, 39.8261761], [21.4226121, 39.8261844], [21.422607, 39.8261737],
  ].map(([lat, lng]) => ({ lat, lng }))),
  safa: { lat: 21.4217996, lng: 39.8274307 },
  marwah: { lat: 21.4251754, lng: 39.8271276 },
  // Green-marker section (about 55 m) as fractions of the Safa -> Marwah distance, from Safa. APPROXIMATE.
  greenZone: [0.2, 0.346],
});

export const STALE_AFTER_MS = 20_000;
export const HEADING_STALE_MS = 5_000;
const MAX_ACCURACY_M = 35;

export function confidenceFor(accuracyM) {
  if (!Number.isFinite(accuracyM)) return 'low';
  if (accuracyM <= 10) return 'high';
  if (accuracyM <= 25) return 'medium';
  return 'low';
}

const toDeg = (r) => (r * 180) / Math.PI;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Anticlockwise degrees travelled from the start line to `bearing`, in [0, 360). */
export const offsetFrom = (bearing, startBearing) => ((((startBearing - bearing) % 360) + 360) % 360);

// Sides of the Kaaba in Tawaf order, as anticlockwise offsets from the start line.
// Corner offsets measured from the mapped outline: ʿIrāqī ≈102°, Shāmī ≈184°, Yemeni ≈283°.
// `duaId` links a stretch to the dua said there, so the app can offer its recitation.
export const KAABA_SECTORS = Object.freeze([
  { id: 'black-stone', from: 345, to: 15, label: 'Black Stone line', tip: 'Point towards the Black Stone and say “Allāhu akbar”.', duaId: 'black-stone' },
  { id: 'door', from: 15, to: 88, label: 'Kaaba door & Multazam', tip: 'Make dua as you wish.' },
  { id: 'iraqi', from: 88, to: 117, label: 'ʿIrāqī corner', tip: 'Next: Ḥijr Ismāʿīl — keep outside its wall.' },
  { id: 'hijr', from: 117, to: 170, label: 'Ḥijr Ismāʿīl', tip: 'Stay OUTSIDE the semicircular wall — it is part of the Kaaba.' },
  { id: 'shami', from: 170, to: 198, label: 'Shāmī corner', tip: 'Make dua as you wish.' },
  { id: 'west', from: 198, to: 268, label: 'West side', tip: 'Make dua as you wish.' },
  { id: 'yemeni', from: 268, to: 298, label: 'Yemeni corner', tip: 'Touch it with your right hand only if easy — no kissing, no pushing.' },
  { id: 'rabbana', from: 298, to: 345, label: 'Yemeni Corner → Black Stone', tip: 'Say: Rabbanā ātinā fid-dunyā ḥasanah, wa fil-ākhirati ḥasanah, wa qinā ʿadhāban-nār.', duaId: 'yemeni-corner' },
]);

export function sectorAt(offset) {
  return KAABA_SECTORS.find((s) => (s.from < s.to ? offset >= s.from && offset < s.to : offset >= s.from || offset < s.to));
}

/**
 * Smooths GPS fixes in local metres around `origin`: drops inaccurate fixes,
 * rejects jumps faster than walking, and blends the rest (1-D Kalman per axis).
 */
export function createPositionFilter({ origin, maxAccuracyM = MAX_ACCURACY_M, maxSpeedMps = 3.5, walkNoiseMps = 2 }) {
  let est = null;
  let rejects = 0;
  return {
    update(sample) {
      if (!Number.isFinite(sample.accuracy) || sample.accuracy > maxAccuracyM) return { ok: false, reason: 'inaccurate' };
      const p = toLocalM(origin, sample);
      const r2 = sample.accuracy ** 2;
      if (est) {
        const dt = Math.max(0.05, (sample.timestamp - est.t) / 1000);
        const limit = maxSpeedMps * dt + sample.accuracy + Math.sqrt(est.v) + 5;
        if (Math.hypot(p.x - est.x, p.y - est.y) > limit) {
          rejects += 1;
          if (rejects < 3) return { ok: false, reason: 'jump' };
          est = null; // three disagreeing fixes in a row: our estimate was the wrong one
        }
      }
      rejects = 0;
      if (!est) {
        est = { x: p.x, y: p.y, v: r2, t: sample.timestamp };
      } else {
        const dt = Math.max(0.05, (sample.timestamp - est.t) / 1000);
        const v = est.v + (walkNoiseMps * dt) ** 2;
        const k = v / (v + r2);
        est = { x: est.x + k * (p.x - est.x), y: est.y + k * (p.y - est.y), v: (1 - k) * v, t: sample.timestamp };
      }
      return { ok: true, x: est.x, y: est.y, accuracyM: Math.sqrt(est.v) };
    },
    reset() {
      est = null;
      rejects = 0;
    },
  };
}

// Trackers never complete anything. They only produce readings with
// `suggestCompletion`; the pilgrim confirms every round and lap themselves.

/**
 * Tawaf tracker fusing three independent signals:
 *  - GPS: angle swept around the Kaaba + corner checkpoints in order,
 *  - compass/gyro: body turning (a full circuit turns you 360°, even indoors),
 *  - steps: sanity check that you actually walked a round.
 */
export function createTawafTracker({ geo = HARAM_GEO, startToleranceDeg = 20, maxRadiusM = 300, maxStepDeg = 60, minStepsPerRound = 40, now = Date.now() } = {}) {
  const filter = createPositionFilter({ origin: geo.kaabaCenter });
  let nowMs = now;
  let refAt = now;
  let gpsLive = false;
  let sawInaccurate = false;
  let outOfArea = false;
  let lastGpsAt = null;
  let prevBearing = null;
  let gpsSwept = 0;
  let position = null;
  let seen = new Set();
  let prevHeading = null;
  let lastHeadingAt = null;
  let headingSwept = 0;
  let steps = null;
  let stepsAtStart = null;
  let current;

  function compute() {
    const gpsOk = gpsLive && lastGpsAt !== null && nowMs - lastGpsAt <= STALE_AFTER_MS;
    const headingOk = lastHeadingAt !== null && nowMs - lastHeadingAt <= HEADING_STALE_MS;
    const stepsThisRound = steps !== null && stepsAtStart !== null ? steps - stepsAtStart : null;
    const enoughSteps = stepsThisRound === null || stepsThisRound >= minStepsPerRound;
    const checkpoints = { iraqi: seen.has(1), shami: seen.has(2), yemeni: seen.has(3) };
    const allCheckpoints = checkpoints.iraqi && checkpoints.shami && checkpoints.yemeni;
    const nearStart = gpsOk && position ? Math.min(position.offset, 360 - position.offset) <= startToleranceDeg : false;

    let status = 'ok';
    let mode = null;
    let progress;
    let agreement = null;
    let suggest = false;
    if (gpsOk) {
      mode = headingOk ? 'gps+compass' : 'gps';
      progress = gpsSwept / 360;
      agreement = headingOk ? (Math.abs(headingSwept - gpsSwept) <= 60 ? 'agree' : 'conflict') : 'single';
      suggest = allCheckpoints && enoughSteps && (gpsSwept >= 360 || (nearStart && gpsSwept >= 360 - startToleranceDeg));
    } else if (headingOk) {
      mode = 'compass';
      progress = Math.max(0, headingSwept) / 360;
      agreement = 'single';
      suggest = enoughSteps && headingSwept >= 350;
    } else {
      progress = gpsSwept / 360;
      if (outOfArea) status = 'out_of_area';
      else if (sawInaccurate || nowMs - (lastGpsAt ?? refAt) > STALE_AFTER_MS) status = 'weak';
      else status = 'waiting';
    }
    const confidence = status !== 'ok' ? null : agreement === 'agree' ? 'high' : agreement === 'conflict' ? 'low' : 'medium';
    return {
      status,
      mode,
      confidence,
      agreement,
      progress: clamp01(progress),
      gpsProgress: clamp01(gpsSwept / 360),
      headingProgress: clamp01(headingSwept / 360),
      checkpoints,
      nearStart,
      sector: gpsOk && position ? sectorAt(position.offset) : null,
      position: gpsOk ? position : null,
      stepsThisRound,
      suggestCompletion: status === 'ok' && suggest,
    };
  }
  current = compute();

  return {
    update(sample) {
      nowMs = Math.max(nowMs, sample.timestamp);
      const f = filter.update(sample);
      if (!f.ok) {
        if (f.reason === 'inaccurate') {
          gpsLive = false;
          sawInaccurate = true;
        }
        return (current = compute());
      }
      const distanceM = Math.hypot(f.x, f.y);
      if (distanceM > maxRadiusM) {
        outOfArea = true;
        gpsLive = false;
        prevBearing = null;
        return (current = compute());
      }
      outOfArea = false;
      sawInaccurate = false;
      gpsLive = true;
      lastGpsAt = sample.timestamp;
      const bearing = (toDeg(Math.atan2(f.x, f.y)) + 360) % 360;
      if (prevBearing !== null) {
        // Tawaf is anticlockwise seen from above (Kaaba on the left), so the bearing decreases.
        const step = normDeg(prevBearing - bearing);
        if (Math.abs(step) <= maxStepDeg) gpsSwept = Math.max(0, gpsSwept + step);
      }
      prevBearing = bearing;
      const offset = offsetFrom(bearing, geo.blackStoneBearingDeg);
      // Checkpoints must be seen in Tawaf order: ʿIrāqī side, then Shāmī, then Yemeni.
      const quadrant = Math.floor(((offset + 45) % 360) / 90);
      if (quadrant === 1 && gpsSwept >= 45) seen.add(1);
      if (quadrant === 2 && seen.has(1)) seen.add(2);
      if (quadrant === 3 && seen.has(2)) seen.add(3);
      position = { x: f.x, y: f.y, accuracyM: f.accuracyM, bearing, offset, distanceM };
      return (current = compute());
    },
    updateHeading(heading, t) {
      nowMs = Math.max(nowMs, t);
      if (prevHeading !== null && lastHeadingAt !== null && t - lastHeadingAt < 2000) {
        const step = normDeg(prevHeading - heading);
        if (Math.abs(step) <= 90) headingSwept += step;
      }
      prevHeading = heading;
      lastHeadingAt = t;
      return (current = compute());
    },
    updateSteps(total, t) {
      nowMs = Math.max(nowMs, t);
      if (stepsAtStart === null) stepsAtStart = total;
      steps = total;
      return (current = compute());
    },
    checkStale(t) {
      nowMs = Math.max(nowMs, t);
      return (current = compute());
    },
    startRound() {
      gpsSwept = 0;
      headingSwept = 0;
      seen = new Set();
      stepsAtStart = steps;
      return (current = compute());
    },
    // Called when tracking restarts (e.g. after a pause): never integrate movement across the gap.
    gap(t = Date.now()) {
      prevBearing = null;
      prevHeading = null;
      lastGpsAt = null;
      lastHeadingAt = null;
      gpsLive = false;
      sawInaccurate = false;
      refAt = t;
      nowMs = t;
      filter.reset();
      return (current = compute());
    },
    get reading() {
      return current;
    },
  };
}

/**
 * Sa'i tracker fusing GPS position along the Mas'a with step counting, which
 * keeps working under the covered Mas'a where GPS is poor.
 */
export function createSaiTracker({ direction, geo = HARAM_GEO, endToleranceM = 20, maxLateralM = 60, greenLookaheadM = 30, stepLengthM = 0.72, now = Date.now() }) {
  const filter = createPositionFilter({ origin: geo.safa });
  const axis = toLocalM(geo.safa, geo.marwah);
  const lengthM = Math.hypot(axis.x, axis.y);
  const [g0, g1] = geo.greenZone;
  const towardsMarwah = direction === 'SAFA_TO_MARWAH';
  let nowMs = now;
  let refAt = now;
  let gpsLive = false;
  let sawInaccurate = false;
  let outOfArea = false;
  let lastGpsAt = null;
  let gpsFromSafa = null;
  let maxProgress = 0;
  let steps = null;
  let stepsAtStart = null;
  let current;

  function greenStatus(fromSafa) {
    if (fromSafa >= g0 && fromSafa <= g1) return 'inside';
    const toZoneM = (towardsMarwah ? g0 - fromSafa : fromSafa - g1) * lengthM;
    return toZoneM <= 0 ? 'passed' : toZoneM <= greenLookaheadM ? 'ahead' : 'before';
  }

  function compute() {
    const gpsOk = gpsLive && lastGpsAt !== null && nowMs - lastGpsAt <= STALE_AFTER_MS;
    const stepsThisLap = steps !== null && stepsAtStart !== null ? steps - stepsAtStart : null;
    const stepProgress = stepsThisLap === null ? null : clamp01((stepsThisLap * stepLengthM) / lengthM);
    let status = 'ok';
    let mode = null;
    let progress;
    let agreement = null;
    if (gpsOk) {
      progress = towardsMarwah ? gpsFromSafa : 1 - gpsFromSafa;
      mode = stepProgress === null ? 'gps' : 'gps+steps';
      agreement = stepProgress === null ? 'single' : Math.abs(stepProgress - progress) <= 0.25 ? 'agree' : 'conflict';
    } else if (stepsThisLap > 0) {
      progress = stepProgress;
      mode = 'steps';
      agreement = 'single';
    } else {
      progress = maxProgress;
      if (outOfArea) status = 'out_of_area';
      else if (sawInaccurate || nowMs - (lastGpsAt ?? refAt) > STALE_AFTER_MS) status = 'weak';
      else status = 'waiting';
    }
    if (status === 'ok') maxProgress = Math.max(maxProgress, progress);
    const fromSafa = towardsMarwah ? progress : 1 - progress;
    const remainingM = (1 - progress) * lengthM;
    const suggest = status === 'ok' && (mode === 'steps' ? progress >= 0.97 : remainingM <= endToleranceM && maxProgress >= 0.6);
    const confidence = status !== 'ok' ? null : agreement === 'agree' ? 'high' : mode === 'gps' ? 'medium' : 'low';
    return {
      status,
      mode,
      confidence,
      agreement,
      progress,
      lengthM,
      fromSafa: status === 'ok' ? fromSafa : null,
      remainingM,
      green: status === 'ok' ? greenStatus(fromSafa) : null,
      stepsThisLap,
      suggestCompletion: suggest,
    };
  }
  current = compute();

  return {
    lengthM,
    update(sample) {
      nowMs = Math.max(nowMs, sample.timestamp);
      const f = filter.update(sample);
      if (!f.ok) {
        if (f.reason === 'inaccurate') {
          gpsLive = false;
          sawInaccurate = true;
        }
        return (current = compute());
      }
      const along = (f.x * axis.x + f.y * axis.y) / lengthM;
      const lateral = Math.abs(f.x * axis.y - f.y * axis.x) / lengthM;
      if (lateral > maxLateralM || along < -maxLateralM || along > lengthM + maxLateralM) {
        outOfArea = true;
        gpsLive = false;
        return (current = compute());
      }
      outOfArea = false;
      sawInaccurate = false;
      gpsLive = true;
      lastGpsAt = sample.timestamp;
      gpsFromSafa = clamp01(along / lengthM);
      return (current = compute());
    },
    updateSteps(total, t) {
      nowMs = Math.max(nowMs, t);
      if (stepsAtStart === null) stepsAtStart = total;
      steps = total;
      return (current = compute());
    },
    checkStale(t) {
      nowMs = Math.max(nowMs, t);
      return (current = compute());
    },
    gap(t = Date.now()) {
      lastGpsAt = null;
      gpsLive = false;
      sawInaccurate = false;
      refAt = t;
      nowMs = t;
      filter.reset();
      return (current = compute());
    },
    get reading() {
      return current;
    },
  };
}
