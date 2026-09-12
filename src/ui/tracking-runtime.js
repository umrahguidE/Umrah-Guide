// Feeds GPS, compass and step sensors into the tracker for the current stage.
// Readings go to the UI; they never change the ritual state — only the
// pilgrim's confirmation does.
import { createSaiTracker, createTawafTracker, HARAM_GEO } from '../engine/tracking.js';
import { parseStage, saiDirection } from '../engine/stages.js';
import { bearingDeg, destination, lerpPoint } from '../engine/geo.js';
import { createSensorSource } from './sensors.js';

const STALE_CHECK_MS = 3000;

function geoSource(onSample, onError) {
  if (!('geolocation' in navigator)) {
    onError('unsupported');
    return { stop() {} };
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onSample({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }),
    (err) => onError(err.code === 1 ? 'denied' : 'unavailable'),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
  );
  return { stop: () => navigator.geolocation.clearWatch(id) };
}

// Walks a Tawaf round (~30 s) or a Sa'i lap (~25 s) with matching compass and
// step data, so the whole fused pipeline can be demonstrated anywhere.
function simSource(target, { onSample, onHeading, onSteps, isDropped }) {
  let tick = 0;
  let steps = 0;
  const timer = setInterval(() => {
    if (isDropped()) return;
    tick += 1;
    const now = Date.now();
    if (target.kind === 'tawaf') {
      const bearing = HARAM_GEO.blackStoneBearingDeg - tick * 6;
      onSample({ ...destination(HARAM_GEO.kaabaCenter, bearing, 35), accuracy: 6, timestamp: now });
      onHeading((((bearing - 90) % 360) + 360) % 360, now);
      steps += 2;
    } else {
      const out = target.direction === 'SAFA_TO_MARWAH';
      const from = out ? HARAM_GEO.safa : HARAM_GEO.marwah;
      const to = out ? HARAM_GEO.marwah : HARAM_GEO.safa;
      onSample({ ...lerpPoint(from, to, Math.min(1, tick / 50)), accuracy: 6, timestamp: now });
      onHeading(bearingDeg(from, to), now);
      steps += 11;
    }
    onSteps(steps, now);
  }, 500);
  return { stop: () => clearInterval(timer) };
}

export function createTrackingRuntime({ onReading, simulate = false, isDropped = () => false, getStepLength = () => 0.72, onSensors = () => {} }) {
  let key = null;
  let kind = null;
  let tracker = null;
  let source = null;
  let sensors = null;
  let staleTimer = null;

  function targetFor(session) {
    if (!session || session.status !== 'active' || session.tracking_mode !== 'assisted') return null;
    const p = parseStage(session.current_stage);
    if (p.kind === 'simple') return null;
    return { kind: p.kind, n: p.n, direction: p.kind === 'sai' ? saiDirection(p.n).key : null };
  }

  const feed = {
    onSample: (sample) => tracker && onReading(tracker.update(sample)),
    onHeading: (heading, t) => tracker?.updateHeading && onReading(tracker.updateHeading(heading, t)),
    onSteps: (steps, t) => tracker?.updateSteps && onReading(tracker.updateSteps(steps, t)),
    onError: (status) => onReading({ ...(tracker?.reading ?? {}), status, suggestCompletion: false }),
    isDropped,
  };

  function startSources(target) {
    source = simulate ? simSource(target, feed) : geoSource(feed.onSample, feed.onError);
    if (!simulate && !sensors) {
      sensors = createSensorSource({ onHeading: feed.onHeading, onSteps: feed.onSteps });
      onSensors(sensors.active);
    }
    staleTimer = setInterval(() => {
      if (!tracker) return;
      const before = tracker.reading.status;
      const r = tracker.checkStale(Date.now());
      if (sensors) onSensors(sensors.active);
      if (r.status !== before) onReading(r);
    }, STALE_CHECK_MS);
  }

  function stopSources({ keepSensors = false } = {}) {
    source?.stop();
    source = null;
    if (!keepSensors) {
      sensors?.stop();
      sensors = null;
    }
    clearInterval(staleTimer);
    staleTimer = null;
  }

  return {
    sync(session) {
      const target = targetFor(session);
      const nextKey = target ? `${target.kind}:${target.n}` : null;
      if (nextKey !== key) {
        stopSources({ keepSensors: Boolean(target) });
        if (!target) {
          tracker = null;
          key = null;
          kind = null;
          onReading(null);
          return;
        }
        // Consecutive Tawaf rounds share a tracker so the circle stays continuous;
        // each Sa'i lap starts a fresh one, with the pilgrim's learned step length.
        if (target.kind === 'tawaf' && kind === 'tawaf' && tracker) tracker.startRound();
        else tracker = target.kind === 'tawaf' ? createTawafTracker() : createSaiTracker({ direction: target.direction, stepLengthM: getStepLength() });
        if (sensors) tracker.updateSteps(sensors.steps, Date.now());
        key = nextKey;
        kind = target.kind;
        onReading(tracker.reading);
      }
      if (!target) return;
      const shouldRun = !session.paused;
      if (shouldRun && !source) {
        tracker.gap(Date.now());
        startSources(target);
      } else if (!shouldRun && source) {
        stopSources({ keepSensors: true });
      }
    },
    stop() {
      stopSources();
      tracker = null;
      key = null;
      kind = null;
    },
  };
}
