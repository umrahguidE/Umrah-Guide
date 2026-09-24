// Pure motion-sensor helpers (steps, step-length calibration). Port of
// src/engine/motion.js; the compass heading itself comes from the platform.
import 'dart:math' as math;

/// Counts steps from accelerometer samples (m/s², including gravity) by
/// detecting peaks above a slowly adapting gravity baseline.
class StepDetector {
  StepDetector({this.thresholdMps2 = 1.1, this.minIntervalMs = 300, this.smoothing = 0.02});

  final double thresholdMps2;
  final double minIntervalMs;
  final double smoothing;

  double? _baseline;
  bool _armed = false;
  double _lastStepAt = double.negativeInfinity;
  int _steps = 0;

  int get steps => _steps;

  int update(double ax, double ay, double az, double tMs) {
    final mag = math.sqrt(ax * ax + ay * ay + az * az);
    _baseline = _baseline == null ? mag : _baseline! + smoothing * (mag - _baseline!);
    final d = mag - _baseline!;
    if (d > thresholdMps2) {
      _armed = true;
    } else if (_armed && d < 0) {
      _armed = false;
      if (tMs - _lastStepAt >= minIntervalMs) {
        _steps += 1;
        _lastStepAt = tMs;
      }
    }
    return _steps;
  }
}

/// Learns the pilgrim's step length from a lap whose distance GPS measured well.
double? calibrateStepLength(double distanceM, int steps, {double min = 0.45, double max = 1.0}) {
  if (steps < 100 || !(distanceM > 0)) return null;
  final len = distanceM / steps;
  return len >= min && len <= max ? len : null;
}
