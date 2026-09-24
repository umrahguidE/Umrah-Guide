// Feeds GPS, compass and step sensors into the tracker for the current stage.
// Readings go to the UI; they never change the ritual state — only the
// pilgrim's confirmation does. Port of src/ui/tracking-runtime.js.
import 'dart:async';

import 'package:flutter_compass/flutter_compass.dart';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../engine/geo.dart';
import '../engine/machine.dart' show Json;
import '../engine/motion.dart';
import '../engine/stages.dart';
import '../engine/tracking.dart';

const int _staleCheckMs = 3000;

typedef ReadingCallback = void Function(TrackingReading? reading);
typedef RawPositionCallback = void Function(PositionSample? sample);

double _nowMs() => DateTime.now().millisecondsSinceEpoch.toDouble();

class TrackingRuntime {
  TrackingRuntime({
    required this.onReading,
    required this.onRawPosition,
    required this.isDropped,
    required this.getStepLength,
    this.simulate = false,
  });

  final ReadingCallback onReading;

  /// The pilgrim's real-world GPS fix (never called for the simulator).
  final RawPositionCallback onRawPosition;
  final bool Function() isDropped;
  final double Function() getStepLength;
  final bool simulate;

  String? _key;
  String? _kind;
  TawafTracker? _tawaf;
  SaiTracker? _sai;
  bool _running = false;
  int _generation = 0;

  StreamSubscription<Position>? _gps;
  StreamSubscription<AccelerometerEvent>? _accel;
  StreamSubscription<CompassEvent>? _compass;
  Timer? _simTimer;
  Timer? _staleTimer;
  final StepDetector _stepDetector = StepDetector();
  int _lastStepCount = 0;
  bool _sensorsOn = false;

  /// Whether a compass / step reading has arrived yet (shown in Settings).
  bool compassSeen = false;
  bool stepsSeen = false;

  ({String kind, int n, String? direction})? _targetFor(Json? session) {
    if (session == null || session['status'] != 'active' || session['tracking_mode'] != 'assisted') return null;
    final p = parseStage(session['current_stage'] as String);
    if (p.kind == 'simple') return null;
    return (kind: p.kind, n: p.n!, direction: p.kind == 'sai' ? saiDirection(p.n!).key : null);
  }

  TrackingReading? get _reading => _tawaf?.reading ?? _sai?.reading;

  // ── feed ──
  void _onSample(PositionSample s) {
    final r = _tawaf?.update(s) ?? _sai?.update(s);
    if (r != null) onReading(r);
  }

  void _onHeading(double heading, double t) {
    compassSeen = true;
    final r = _tawaf?.updateHeading(heading, t);
    if (r != null) onReading(r);
  }

  void _onSteps(int steps, double t) {
    stepsSeen = true;
    final r = _tawaf?.updateSteps(steps, t) ?? _sai?.updateSteps(steps, t);
    if (r != null) onReading(r);
  }

  void _onError(String status) {
    final base = _reading ?? const TrackingReading(status: 'waiting');
    onReading(base.withStatus(status));
  }

  // ── sources ──
  Future<void> _startGps(int gen) async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return _onError('unavailable');
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (gen != _generation) return;
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return _onError('denied');
      _gps = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 0),
      ).listen(
        (p) {
          if (gen != _generation) return;
          final sample = PositionSample(lat: p.latitude, lng: p.longitude, accuracy: p.accuracy, timestamp: p.timestamp.millisecondsSinceEpoch.toDouble());
          onRawPosition(sample); // before the tracker reduces it to local metres around the Kaaba
          _onSample(sample);
        },
        onError: (_) => _onError('unavailable'),
      );
    } catch (_) {
      _onError('unsupported');
    }
  }

  void _startSensors() {
    if (_sensorsOn) return;
    _sensorsOn = true;
    try {
      _accel = accelerometerEventStream(samplingPeriod: SensorInterval.gameInterval).listen((e) {
        stepsSeen = true;
        final t = _nowMs();
        final steps = _stepDetector.update(e.x, e.y, e.z, t);
        if (steps != _lastStepCount) {
          _lastStepCount = steps;
          _onSteps(steps, t);
        }
      }, onError: (_) {});
    } catch (_) {}
    try {
      _compass = FlutterCompass.events?.listen((e) {
        final h = e.heading;
        if (h != null) _onHeading((h % 360 + 360) % 360, _nowMs());
      }, onError: (_) {});
    } catch (_) {}
  }

  void _stopSensors() {
    _accel?.cancel();
    _compass?.cancel();
    _accel = null;
    _compass = null;
    _sensorsOn = false;
  }

  // Walks a Tawaf round (~30 s) or a Sa'i lap (~25 s) with matching compass and
  // step data, so the whole fused pipeline can be demonstrated anywhere.
  void _startSim(({String kind, int n, String? direction}) target) {
    var tick = 0;
    var steps = 0;
    _simTimer = Timer.periodic(const Duration(milliseconds: 500), (_) {
      if (isDropped()) return;
      tick += 1;
      final now = _nowMs();
      if (target.kind == 'tawaf') {
        final bearing = haramGeo.blackStoneBearingDeg - tick * 6;
        final p = destination(haramGeo.kaabaCenter, bearing, 35);
        _onSample(PositionSample(lat: p.lat, lng: p.lng, accuracy: 6, timestamp: now));
        _onHeading((((bearing - 90) % 360) + 360) % 360, now);
        steps += 2;
      } else {
        final out = target.direction == 'SAFA_TO_MARWAH';
        final from = out ? haramGeo.safa : haramGeo.marwah;
        final to = out ? haramGeo.marwah : haramGeo.safa;
        final p = lerpPoint(from, to, (tick / 50).clamp(0.0, 1.0));
        _onSample(PositionSample(lat: p.lat, lng: p.lng, accuracy: 6, timestamp: now));
        _onHeading(bearingDeg(from, to), now);
        steps += 11;
      }
      _onSteps(steps, now);
    });
  }

  void _startSources(({String kind, int n, String? direction}) target) {
    _running = true;
    _generation += 1;
    if (simulate) {
      _startSim(target);
    } else {
      _startGps(_generation);
      _startSensors();
    }
    _staleTimer = Timer.periodic(const Duration(milliseconds: _staleCheckMs), (_) {
      final t = _tawaf;
      final s = _sai;
      final before = _reading?.status;
      final r = t != null ? t.checkStale(_nowMs()) : s?.checkStale(_nowMs());
      if (r != null && r.status != before) onReading(r);
    });
  }

  void _stopSources({bool keepSensors = false}) {
    _running = false;
    _generation += 1;
    _gps?.cancel();
    _gps = null;
    _simTimer?.cancel();
    _simTimer = null;
    _staleTimer?.cancel();
    _staleTimer = null;
    if (!keepSensors) _stopSensors();
  }

  /// Call whenever the ritual state changes.
  void sync(Json? session) {
    final target = _targetFor(session);
    final nextKey = target == null ? null : '${target.kind}:${target.n}';
    if (nextKey != _key) {
      _stopSources(keepSensors: target != null);
      if (target == null) {
        _tawaf = null;
        _sai = null;
        _key = null;
        _kind = null;
        onReading(null);
        onRawPosition(null);
        return;
      }
      // Consecutive Tawaf rounds share a tracker so the circle stays continuous;
      // each Sa'i lap starts a fresh one, with the pilgrim's learned step length.
      if (target.kind == 'tawaf' && _kind == 'tawaf' && _tawaf != null) {
        _tawaf!.startRound();
      } else if (target.kind == 'tawaf') {
        _tawaf = TawafTracker();
        _sai = null;
      } else {
        _sai = SaiTracker(direction: target.direction!, stepLengthM: getStepLength());
        _tawaf = null;
      }
      if (_sensorsOn) {
        final t = _nowMs();
        _tawaf?.updateSteps(_lastStepCount, t);
        _sai?.updateSteps(_lastStepCount, t);
      }
      _key = nextKey;
      _kind = target.kind;
      onReading(_reading);
    }
    if (target == null) return;
    final shouldRun = session!['paused'] != true;
    if (shouldRun && !_running) {
      _tawaf?.gap(_nowMs());
      _sai?.gap(_nowMs());
      _startSources(target);
    } else if (!shouldRun && _running) {
      _stopSources(keepSensors: true);
    }
  }

  void stop() {
    _stopSources();
    _tawaf = null;
    _sai = null;
    _key = null;
    _kind = null;
  }
}
