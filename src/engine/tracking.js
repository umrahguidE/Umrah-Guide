import { normDeg, toLocalM } from './geo.js';

/**
 * Site geometry. EVERY value here is an approximate placeholder and must be
 * surveyed on site before release (README -> "Calibration").
 */
export const HARAM_GEO = Object.freeze({
  kaabaCenter: { lat: 21.422487, lng: 39.826206 },
  // Bearing from the Kaaba's centre to the Black Stone corner, degrees clockwise from north.
  blackStoneBearingDeg: 95,
  safa: { lat: 21.42188, lng: 39.82746 },
  marwah: { lat: 21.42537, lng: 39.82727 },
  // Green-marker section as fractions of the Safa -> Marwah distance, measured from Safa.
  greenZone: [0.19, 0.34],
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

// Sides of the Kaaba in Tawaf order, as anticlockwise offsets from the Black Stone line.
export const KAABA_SECTORS = Object.freeze([
  { id: 'black-stone', from: 345, to: 15, label: 'Black Stone line', tip: 'Point towards the Black Stone and say “Allāhu akbar”.' },
  { id: 'door', from: 15, to: 75, label: 'Kaaba door & Multazam', tip: 'Make dua as you wish.' },
  { id: 'iraqi', from: 75, to: 105, label: 'ʿIrāqī corner', tip: 'Next: Ḥijr Ismāʿīl — keep outside its wall.' },
  { id: 'hijr', from: 105, to: 165, label: 'Ḥijr Ismāʿīl', tip: 'Stay OUTSIDE the semicircular wall — it is part of the Kaaba.' },
  { id: 'shami', from: 165, to: 195, label: 'Shāmī corner', tip: 'Make dua as you wish.' },
  { id: 'west', from: 195, to: 255, label: 'West side', tip: 'Make dua as you wish.' },
  { id: 'yemeni', from: 255, to: 285, label: 'Yemeni corner', tip: 'Touch it with your right hand only if easy — no kissing, no pushing.' },
  { id: 'rabbana', from: 285, to: 345, label: 'Yemeni Corner → Black Stone', tip: 'Say: Rabbanā ātinā fid-dunyā ḥasanah, wa fil-ākhirati ḥasanah, wa qinā ʿadhāban-nār.' },
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
