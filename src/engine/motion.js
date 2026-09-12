// Pure motion-sensor helpers (steps, heading, step-length calibration), testable in Node.

/**
 * Counts steps from accelerometer samples (m/s², including gravity) by
 * detecting peaks above a slowly adapting gravity baseline.
 */
export function createStepDetector({ thresholdMps2 = 1.1, minIntervalMs = 300, smoothing = 0.02 } = {}) {
  let baseline = null;
  let armed = false;
  let lastStepAt = -Infinity;
  let steps = 0;
  return {
    update(ax, ay, az, t) {
      const mag = Math.hypot(ax, ay, az);
      baseline = baseline === null ? mag : baseline + smoothing * (mag - baseline);
      const d = mag - baseline;
      if (d > thresholdMps2) armed = true;
      else if (armed && d < 0) {
        armed = false;
        if (t - lastStepAt >= minIntervalMs) {
          steps += 1;
          lastStepAt = t;
        }
      }
      return steps;
    },
    get steps() {
      return steps;
    },
  };
}

/** Compass-style heading (degrees clockwise) from a DeviceOrientationEvent-like object, or null. */
export function headingFromOrientation(e) {
  if (Number.isFinite(e?.webkitCompassHeading)) return e.webkitCompassHeading;
  if (Number.isFinite(e?.alpha)) return (360 - e.alpha) % 360;
  return null;
}

/** Learns the pilgrim's step length from a lap whose distance GPS measured well. */
export function calibrateStepLength(distanceM, steps, { min = 0.45, max = 1.0 } = {}) {
  if (!(steps >= 100) || !(distanceM > 0)) return null;
  const len = distanceM / steps;
  return len >= min && len <= max ? len : null;
}
