// Compass and step sensors. These keep counting where GPS cannot: under the
// Mataf roof, on the upper floors, and along the covered Mas'a.
import { createStepDetector, headingFromOrientation } from '../engine/motion.js';

export const motionPermissionNeeded = () =>
  typeof DeviceMotionEvent?.requestPermission === 'function' || typeof DeviceOrientationEvent?.requestPermission === 'function';

/** iOS only grants motion and compass access from a user gesture. */
export async function requestMotionPermission() {
  const asks = [];
  if (typeof DeviceMotionEvent?.requestPermission === 'function') asks.push(DeviceMotionEvent.requestPermission());
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') asks.push(DeviceOrientationEvent.requestPermission());
  if (!asks.length) return 'granted';
  try {
    return (await Promise.all(asks)).every((r) => r === 'granted') ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

export function createSensorSource({ onHeading, onSteps, headingIntervalMs = 250 }) {
  const detector = createStepDetector();
  let lastHeadingAt = 0;
  let lastSteps = -1;
  let gotHeading = false;
  let gotMotion = false;

  const handleOrientation = (e) => {
    const heading = headingFromOrientation(e);
    if (heading === null) return;
    const now = Date.now();
    if (now - lastHeadingAt < headingIntervalMs) return;
    lastHeadingAt = now;
    gotHeading = true;
    onHeading(heading, now);
  };

  const handleMotion = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x === null) return;
    gotMotion = true;
    const now = Date.now();
    const steps = detector.update(a.x ?? 0, a.y ?? 0, a.z ?? 0, now);
    if (steps !== lastSteps) {
      lastSteps = steps;
      onSteps(steps, now);
    }
  };

  window.addEventListener('deviceorientationabsolute', handleOrientation, true);
  window.addEventListener('deviceorientation', handleOrientation, true);
  window.addEventListener('devicemotion', handleMotion);

  return {
    get steps() {
      return detector.steps;
    },
    get active() {
      return { compass: gotHeading, steps: gotMotion };
    },
    stop() {
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
      window.removeEventListener('devicemotion', handleMotion);
    },
  };
}
