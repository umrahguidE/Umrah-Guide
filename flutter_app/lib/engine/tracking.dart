// Tawaf and Sa'i trackers: fused GPS / compass / step readings that only ever
// *suggest* that a round or lap may be finished — the pilgrim confirms every
// one. Port of src/engine/tracking.js.
import 'dart:math' as math;

import 'geo.dart';

/// Site geometry from OpenStreetMap (© OpenStreetMap contributors, ODbL),
/// retrieved 2026-09-14:
///  - Kaaba outline with named corners ........ way 103914569
///  - marked Tawaf start/end line ............. way 671147142
///  - Maqām Ibrāhīm ........................... way 473301379
///  - Ḥijr Ismāʿīl ............................ way 315911894
///  - Safa and Marwah hilltops ................ nodes 4589923995, 4589923996
/// Mapped features can still be a few metres out; confirm on site before
/// release. The green-marker section of the Mas'a is NOT mapped: its position
/// is approximate.
class HaramGeo {
  const HaramGeo({
    required this.kaabaCenter,
    required this.blackStone,
    required this.iraqi,
    required this.shami,
    required this.yemeni,
    required this.startLine,
    required this.blackStoneBearingDeg,
    required this.maqam,
    required this.hijr,
    required this.safa,
    required this.marwah,
    required this.greenZone,
  });

  final GeoPoint kaabaCenter;
  final GeoPoint blackStone;
  final GeoPoint iraqi;
  final GeoPoint shami;
  final GeoPoint yemeni;

  /// Marked on the Mataf floor from the Black Stone to the green light on the wall.
  final List<GeoPoint> startLine;

  /// Bearing of that line seen from the Kaaba's centre, where pilgrims cross it (20–80 m out).
  final double blackStoneBearingDeg;
  final GeoPoint maqam;
  final List<GeoPoint> hijr;
  final GeoPoint safa;
  final GeoPoint marwah;

  /// Green-marker section (about 55 m) as fractions of the Safa -> Marwah
  /// distance, from Safa. APPROXIMATE.
  final List<double> greenZone;
}

const HaramGeo haramGeo = HaramGeo(
  kaabaCenter: GeoPoint(21.4225171, 39.8261825),
  blackStone: GeoPoint(21.4224985, 39.8262546),
  iraqi: GeoPoint(21.4225861, 39.8261922),
  shami: GeoPoint(21.4225371, 39.8261095),
  yemeni: GeoPoint(21.4224468, 39.8261735),
  startLine: [
    GeoPoint(21.4224985, 39.8262546),
    GeoPoint(21.4224083, 39.8265193),
    GeoPoint(21.4222904, 39.8268401),
  ],
  blackStoneBearingDeg: 110,
  maqam: GeoPoint(21.4225789, 39.8263055),
  hijr: [
    GeoPoint(21.422607, 39.8261737), GeoPoint(21.4226204, 39.8261664), GeoPoint(21.4226305, 39.8261545), GeoPoint(21.422636, 39.8261395),
    GeoPoint(21.4226362, 39.8261234), GeoPoint(21.4226311, 39.8261083), GeoPoint(21.4226209, 39.8260957), GeoPoint(21.4226071, 39.826088),
    GeoPoint(21.4225916, 39.8260862), GeoPoint(21.4225766, 39.8260907), GeoPoint(21.4225642, 39.8261007), GeoPoint(21.4225575, 39.8260911),
    GeoPoint(21.4225716, 39.8260797), GeoPoint(21.4225907, 39.826074), GeoPoint(21.4226104, 39.8260763), GeoPoint(21.4226279, 39.8260861),
    GeoPoint(21.4226409, 39.8261021), GeoPoint(21.4226474, 39.8261214), GeoPoint(21.4226471, 39.8261419), GeoPoint(21.4226401, 39.8261609),
    GeoPoint(21.4226273, 39.8261761), GeoPoint(21.4226121, 39.8261844), GeoPoint(21.422607, 39.8261737),
  ],
  safa: GeoPoint(21.4217996, 39.8274307),
  marwah: GeoPoint(21.4251754, 39.8271276),
  greenZone: [0.2, 0.346],
);

// The close-up Haram map only covers the mosque grounds (Marwah, the farthest
// marked point, is ~310 m from the Kaaba) — beyond this a live position would
// just be an invisible dot off the edge of the drawing.
const double mapRangeM = 500;

const double staleAfterMs = 20000;
const double headingStaleMs = 5000;
const double _maxAccuracyM = 35;

String confidenceFor(double accuracyM) {
  if (!accuracyM.isFinite) return 'low';
  if (accuracyM <= 10) return 'high';
  if (accuracyM <= 25) return 'medium';
  return 'low';
}

double _toDeg(double r) => r * 180 / math.pi;
double _clamp01(double v) => math.min(1, math.max(0, v));

/// Anticlockwise degrees travelled from the start line to [bearing], in [0, 360).
double offsetFrom(double bearing, double startBearing) => (((startBearing - bearing) % 360) + 360) % 360;

class KaabaSector {
  const KaabaSector({required this.id, required this.from, required this.to, required this.label, required this.tip, this.duaId});
  final String id;
  final double from;
  final double to;
  final String label;
  final String tip;
  final String? duaId;
}

// Sides of the Kaaba in Tawaf order, as anticlockwise offsets from the start
// line. Corner offsets measured from the mapped outline: ʿIrāqī ≈102°, Shāmī
// ≈184°, Yemeni ≈283°. `duaId` links a stretch to the dua said there, so the
// app can offer its recitation.
const List<KaabaSector> kaabaSectors = [
  KaabaSector(id: 'black-stone', from: 345, to: 15, label: 'Black Stone line', tip: 'Point towards the Black Stone and say “Allāhu akbar”.', duaId: 'black-stone'),
  KaabaSector(id: 'door', from: 15, to: 88, label: 'Kaaba door & Multazam', tip: 'Make dua as you wish.'),
  KaabaSector(id: 'iraqi', from: 88, to: 117, label: 'ʿIrāqī corner', tip: 'Next: Ḥijr Ismāʿīl — keep outside its wall.'),
  KaabaSector(id: 'hijr', from: 117, to: 170, label: 'Ḥijr Ismāʿīl', tip: 'Stay OUTSIDE the semicircular wall — it is part of the Kaaba.'),
  KaabaSector(id: 'shami', from: 170, to: 198, label: 'Shāmī corner', tip: 'Make dua as you wish.'),
  KaabaSector(id: 'west', from: 198, to: 268, label: 'West side', tip: 'Make dua as you wish.'),
  KaabaSector(id: 'yemeni', from: 268, to: 298, label: 'Yemeni corner', tip: 'Touch it with your right hand only if easy — no kissing, no pushing.'),
  KaabaSector(id: 'rabbana', from: 298, to: 345, label: 'Yemeni Corner → Black Stone', tip: 'Say: Rabbanā ātinā fid-dunyā ḥasanah, wa fil-ākhirati ḥasanah, wa qinā ʿadhāban-nār.', duaId: 'yemeni-corner'),
];

KaabaSector? sectorAt(double offset) {
  for (final s in kaabaSectors) {
    final inside = s.from < s.to ? (offset >= s.from && offset < s.to) : (offset >= s.from || offset < s.to);
    if (inside) return s;
  }
  return null;
}

class PositionSample {
  const PositionSample({required this.lat, required this.lng, required this.accuracy, required this.timestamp});
  final double lat;
  final double lng;

  /// Metres.
  final double accuracy;

  /// Milliseconds since the epoch.
  final double timestamp;
}

class FilterResult {
  const FilterResult.ok(this.x, this.y, this.accuracyM)
      : ok = true,
        reason = null;
  const FilterResult.rejected(this.reason)
      : ok = false,
        x = 0,
        y = 0,
        accuracyM = 0;
  final bool ok;
  final String? reason;
  final double x;
  final double y;
  final double accuracyM;
}

class _Est {
  _Est(this.x, this.y, this.v, this.t);
  double x;
  double y;
  double v;
  double t;
}

/// Smooths GPS fixes in local metres around [origin]: drops inaccurate fixes,
/// rejects jumps faster than walking, and blends the rest (1-D Kalman per axis).
class PositionFilter {
  PositionFilter({required this.origin, this.maxAccuracyM = _maxAccuracyM, this.maxSpeedMps = 3.5, this.walkNoiseMps = 2});

  final GeoPoint origin;
  final double maxAccuracyM;
  final double maxSpeedMps;
  final double walkNoiseMps;

  _Est? _est;
  int _rejects = 0;

  FilterResult update(PositionSample sample) {
    if (!sample.accuracy.isFinite || sample.accuracy > maxAccuracyM) return const FilterResult.rejected('inaccurate');
    final p = toLocalM(origin, GeoPoint(sample.lat, sample.lng));
    final r2 = sample.accuracy * sample.accuracy;
    final est = _est;
    if (est != null) {
      final dt = math.max(0.05, (sample.timestamp - est.t) / 1000);
      final limit = maxSpeedMps * dt + sample.accuracy + math.sqrt(est.v) + 5;
      final dx = p.x - est.x;
      final dy = p.y - est.y;
      if (math.sqrt(dx * dx + dy * dy) > limit) {
        _rejects += 1;
        if (_rejects < 3) return const FilterResult.rejected('jump');
        _est = null; // three disagreeing fixes in a row: our estimate was the wrong one
      }
    }
    _rejects = 0;
    final cur = _est;
    if (cur == null) {
      _est = _Est(p.x, p.y, r2, sample.timestamp);
    } else {
      final dt = math.max(0.05, (sample.timestamp - cur.t) / 1000);
      final v = cur.v + math.pow(walkNoiseMps * dt, 2);
      final k = v / (v + r2);
      _est = _Est(cur.x + k * (p.x - cur.x), cur.y + k * (p.y - cur.y), (1 - k) * v, sample.timestamp);
    }
    final e = _est!;
    return FilterResult.ok(e.x, e.y, math.sqrt(e.v));
  }

  void reset() {
    _est = null;
    _rejects = 0;
  }
}

class Checkpoints {
  const Checkpoints({required this.iraqi, required this.shami, required this.yemeni});
  final bool iraqi;
  final bool shami;
  final bool yemeni;
  bool get all => iraqi && shami && yemeni;
}

class TawafPosition {
  const TawafPosition({required this.x, required this.y, required this.accuracyM, required this.bearing, required this.offset, required this.distanceM});
  final double x;
  final double y;
  final double accuracyM;
  final double bearing;
  final double offset;
  final double distanceM;
}

/// One reading from either tracker. Tawaf fills the tawaf fields, Sa'i the sai
/// ones; `status` is 'ok', 'waiting', 'weak', 'out_of_area' — or, from the
/// runtime, 'denied', 'unavailable' or 'unsupported'.
class TrackingReading {
  const TrackingReading({
    required this.status,
    this.mode,
    this.confidence,
    this.agreement,
    this.progress = 0,
    this.gpsProgress = 0,
    this.headingProgress = 0,
    this.checkpoints,
    this.nearStart = false,
    this.sector,
    this.position,
    this.stepsThisRound,
    this.lengthM,
    this.fromSafa,
    this.remainingM,
    this.green,
    this.stepsThisLap,
    this.suggestCompletion = false,
  });

  final String status;
  final String? mode;
  final String? confidence;
  final String? agreement;
  final double progress;
  final double gpsProgress;
  final double headingProgress;
  final Checkpoints? checkpoints;
  final bool nearStart;
  final KaabaSector? sector;
  final TawafPosition? position;
  final int? stepsThisRound;
  final double? lengthM;
  final double? fromSafa;
  final double? remainingM;
  final String? green;
  final int? stepsThisLap;
  final bool suggestCompletion;

  bool get isOk => status == 'ok';

  /// The same reading with a different status (used for sensor errors).
  TrackingReading withStatus(String newStatus) => TrackingReading(
        status: newStatus,
        mode: mode,
        confidence: confidence,
        agreement: agreement,
        progress: progress,
        gpsProgress: gpsProgress,
        headingProgress: headingProgress,
        checkpoints: checkpoints,
        nearStart: nearStart,
        sector: sector,
        position: position,
        stepsThisRound: stepsThisRound,
        lengthM: lengthM,
        fromSafa: fromSafa,
        remainingM: remainingM,
        green: green,
        stepsThisLap: stepsThisLap,
        suggestCompletion: false,
      );
}


/// Tawaf tracker fusing three independent signals:
///  - GPS: angle swept around the Kaaba + corner checkpoints in order,
///  - compass/gyro: body turning (a full circuit turns you 360°, even indoors),
///  - steps: sanity check that you actually walked a round.
class TawafTracker {
  TawafTracker({
    this.geo = haramGeo,
    this.startToleranceDeg = 20,
    this.maxRadiusM = 300,
    this.maxStepDeg = 60,
    this.minStepsPerRound = 40,
    double? now,
  })  : _filter = PositionFilter(origin: geo.kaabaCenter),
        _nowMs = now ?? _nowMsValue(),
        _refAt = now ?? _nowMsValue() {
    _current = _compute();
  }

  static double _nowMsValue() => DateTime.now().millisecondsSinceEpoch.toDouble();

  final HaramGeo geo;
  final double startToleranceDeg;
  final double maxRadiusM;
  final double maxStepDeg;
  final int minStepsPerRound;

  final PositionFilter _filter;
  double _nowMs;
  double _refAt;
  bool _gpsLive = false;
  bool _sawInaccurate = false;
  bool _outOfArea = false;
  double? _lastGpsAt;
  double? _prevBearing;
  double _gpsSwept = 0;
  TawafPosition? _position;
  Set<int> _seen = {};
  double? _prevHeading;
  double? _lastHeadingAt;
  double _headingSwept = 0;
  int? _steps;
  int? _stepsAtStart;
  late TrackingReading _current;

  TrackingReading get reading => _current;

  TrackingReading _compute() {
    final gpsOk = _gpsLive && _lastGpsAt != null && _nowMs - _lastGpsAt! <= staleAfterMs;
    final headingOk = _lastHeadingAt != null && _nowMs - _lastHeadingAt! <= headingStaleMs;
    final stepsThisRound = _steps != null && _stepsAtStart != null ? _steps! - _stepsAtStart! : null;
    final enoughSteps = stepsThisRound == null || stepsThisRound >= minStepsPerRound;
    final checkpoints = Checkpoints(iraqi: _seen.contains(1), shami: _seen.contains(2), yemeni: _seen.contains(3));
    final allCheckpoints = checkpoints.all;
    final nearStart = gpsOk && _position != null ? math.min(_position!.offset, 360 - _position!.offset) <= startToleranceDeg : false;

    var status = 'ok';
    String? mode;
    double progress;
    String? agreement;
    var suggest = false;
    if (gpsOk) {
      mode = headingOk ? 'gps+compass' : 'gps';
      progress = _gpsSwept / 360;
      agreement = headingOk ? ((_headingSwept - _gpsSwept).abs() <= 60 ? 'agree' : 'conflict') : 'single';
      suggest = allCheckpoints && enoughSteps && (_gpsSwept >= 360 || (nearStart && _gpsSwept >= 360 - startToleranceDeg));
    } else if (headingOk) {
      mode = 'compass';
      progress = math.max(0, _headingSwept) / 360;
      agreement = 'single';
      suggest = enoughSteps && _headingSwept >= 350;
    } else {
      progress = _gpsSwept / 360;
      if (_outOfArea) {
        status = 'out_of_area';
      } else if (_sawInaccurate || _nowMs - (_lastGpsAt ?? _refAt) > staleAfterMs) {
        status = 'weak';
      } else {
        status = 'waiting';
      }
    }
    final confidence = status != 'ok' ? null : (agreement == 'agree' ? 'high' : (agreement == 'conflict' ? 'low' : 'medium'));
    return TrackingReading(
      status: status,
      mode: mode,
      confidence: confidence,
      agreement: agreement,
      progress: _clamp01(progress),
      gpsProgress: _clamp01(_gpsSwept / 360),
      headingProgress: _clamp01(_headingSwept / 360),
      checkpoints: checkpoints,
      nearStart: nearStart,
      sector: gpsOk && _position != null ? sectorAt(_position!.offset) : null,
      position: gpsOk ? _position : null,
      stepsThisRound: stepsThisRound,
      suggestCompletion: status == 'ok' && suggest,
    );
  }

  TrackingReading update(PositionSample sample) {
    _nowMs = math.max(_nowMs, sample.timestamp);
    final f = _filter.update(sample);
    if (!f.ok) {
      if (f.reason == 'inaccurate') {
        _gpsLive = false;
        _sawInaccurate = true;
      }
      return _current = _compute();
    }
    final distanceM = math.sqrt(f.x * f.x + f.y * f.y);
    if (distanceM > maxRadiusM) {
      _outOfArea = true;
      _gpsLive = false;
      _prevBearing = null;
      return _current = _compute();
    }
    _outOfArea = false;
    _sawInaccurate = false;
    _gpsLive = true;
    _lastGpsAt = sample.timestamp;
    final bearing = (_toDeg(math.atan2(f.x, f.y)) + 360) % 360;
    if (_prevBearing != null) {
      // Tawaf is anticlockwise seen from above (Kaaba on the left), so the bearing decreases.
      final step = normDeg(_prevBearing! - bearing);
      if (step.abs() <= maxStepDeg) _gpsSwept = math.max(0, _gpsSwept + step);
    }
    _prevBearing = bearing;
    final offset = offsetFrom(bearing, geo.blackStoneBearingDeg);
    // Checkpoints must be seen in Tawaf order: ʿIrāqī side, then Shāmī, then Yemeni.
    final quadrant = (((offset + 45) % 360) / 90).floor();
    if (quadrant == 1 && _gpsSwept >= 45) _seen.add(1);
    if (quadrant == 2 && _seen.contains(1)) _seen.add(2);
    if (quadrant == 3 && _seen.contains(2)) _seen.add(3);
    _position = TawafPosition(x: f.x, y: f.y, accuracyM: f.accuracyM, bearing: bearing, offset: offset, distanceM: distanceM);
    return _current = _compute();
  }

  TrackingReading updateHeading(double heading, double t) {
    _nowMs = math.max(_nowMs, t);
    if (_prevHeading != null && _lastHeadingAt != null && t - _lastHeadingAt! < 2000) {
      final step = normDeg(_prevHeading! - heading);
      if (step.abs() <= 90) _headingSwept += step;
    }
    _prevHeading = heading;
    _lastHeadingAt = t;
    return _current = _compute();
  }

  TrackingReading updateSteps(int total, double t) {
    _nowMs = math.max(_nowMs, t);
    _stepsAtStart ??= total;
    _steps = total;
    return _current = _compute();
  }

  TrackingReading checkStale(double t) {
    _nowMs = math.max(_nowMs, t);
    return _current = _compute();
  }

  TrackingReading startRound() {
    _gpsSwept = 0;
    _headingSwept = 0;
    _seen = {};
    _stepsAtStart = _steps;
    return _current = _compute();
  }

  /// Called when tracking restarts (e.g. after a pause): never integrate
  /// movement across the gap.
  TrackingReading gap([double? t]) {
    final at = t ?? _nowMsValue();
    _prevBearing = null;
    _prevHeading = null;
    _lastGpsAt = null;
    _lastHeadingAt = null;
    _gpsLive = false;
    _sawInaccurate = false;
    _refAt = at;
    _nowMs = at;
    _filter.reset();
    return _current = _compute();
  }
}

/// Sa'i tracker fusing GPS position along the Mas'a with step counting, which
/// keeps working under the covered Mas'a where GPS is poor.
class SaiTracker {
  SaiTracker({
    required this.direction,
    this.geo = haramGeo,
    this.endToleranceM = 20,
    this.maxLateralM = 60,
    this.greenLookaheadM = 30,
    this.stepLengthM = 0.72,
    double? now,
  })  : _filter = PositionFilter(origin: geo.safa),
        _axis = toLocalM(geo.safa, geo.marwah),
        _nowMs = now ?? TawafTracker._nowMsValue(),
        _refAt = now ?? TawafTracker._nowMsValue() {
    lengthM = math.sqrt(_axis.x * _axis.x + _axis.y * _axis.y);
    _towardsMarwah = direction == 'SAFA_TO_MARWAH';
    _current = _compute();
  }

  /// 'SAFA_TO_MARWAH' or 'MARWAH_TO_SAFA'.
  final String direction;
  final HaramGeo geo;
  final double endToleranceM;
  final double maxLateralM;
  final double greenLookaheadM;
  final double stepLengthM;

  final PositionFilter _filter;
  final LocalPoint _axis;
  late final double lengthM;
  late final bool _towardsMarwah;
  double _nowMs;
  double _refAt;
  bool _gpsLive = false;
  bool _sawInaccurate = false;
  bool _outOfArea = false;
  double? _lastGpsAt;
  double? _gpsFromSafa;
  double _maxProgress = 0;
  int? _steps;
  int? _stepsAtStart;
  late TrackingReading _current;

  TrackingReading get reading => _current;

  String _greenStatus(double fromSafa) {
    final g0 = geo.greenZone[0];
    final g1 = geo.greenZone[1];
    if (fromSafa >= g0 && fromSafa <= g1) return 'inside';
    final toZoneM = (_towardsMarwah ? g0 - fromSafa : fromSafa - g1) * lengthM;
    return toZoneM <= 0 ? 'passed' : (toZoneM <= greenLookaheadM ? 'ahead' : 'before');
  }

  TrackingReading _compute() {
    final gpsOk = _gpsLive && _lastGpsAt != null && _nowMs - _lastGpsAt! <= staleAfterMs;
    final stepsThisLap = _steps != null && _stepsAtStart != null ? _steps! - _stepsAtStart! : null;
    final stepProgress = stepsThisLap == null ? null : _clamp01((stepsThisLap * stepLengthM) / lengthM);
    var status = 'ok';
    String? mode;
    double progress;
    String? agreement;
    if (gpsOk) {
      progress = _towardsMarwah ? _gpsFromSafa! : 1 - _gpsFromSafa!;
      mode = stepProgress == null ? 'gps' : 'gps+steps';
      agreement = stepProgress == null ? 'single' : ((stepProgress - progress).abs() <= 0.25 ? 'agree' : 'conflict');
    } else if (stepsThisLap != null && stepsThisLap > 0) {
      progress = stepProgress!;
      mode = 'steps';
      agreement = 'single';
    } else {
      progress = _maxProgress;
      if (_outOfArea) {
        status = 'out_of_area';
      } else if (_sawInaccurate || _nowMs - (_lastGpsAt ?? _refAt) > staleAfterMs) {
        status = 'weak';
      } else {
        status = 'waiting';
      }
    }
    if (status == 'ok') _maxProgress = math.max(_maxProgress, progress);
    final fromSafa = _towardsMarwah ? progress : 1 - progress;
    final remainingM = (1 - progress) * lengthM;
    final suggest = status == 'ok' && (mode == 'steps' ? progress >= 0.97 : (remainingM <= endToleranceM && _maxProgress >= 0.6));
    final confidence = status != 'ok' ? null : (agreement == 'agree' ? 'high' : (mode == 'gps' ? 'medium' : 'low'));
    return TrackingReading(
      status: status,
      mode: mode,
      confidence: confidence,
      agreement: agreement,
      progress: progress,
      lengthM: lengthM,
      fromSafa: status == 'ok' ? fromSafa : null,
      remainingM: remainingM,
      green: status == 'ok' ? _greenStatus(fromSafa) : null,
      stepsThisLap: stepsThisLap,
      suggestCompletion: suggest,
    );
  }

  TrackingReading update(PositionSample sample) {
    _nowMs = math.max(_nowMs, sample.timestamp);
    final f = _filter.update(sample);
    if (!f.ok) {
      if (f.reason == 'inaccurate') {
        _gpsLive = false;
        _sawInaccurate = true;
      }
      return _current = _compute();
    }
    final along = (f.x * _axis.x + f.y * _axis.y) / lengthM;
    final lateral = (f.x * _axis.y - f.y * _axis.x).abs() / lengthM;
    if (lateral > maxLateralM || along < -maxLateralM || along > lengthM + maxLateralM) {
      _outOfArea = true;
      _gpsLive = false;
      return _current = _compute();
    }
    _outOfArea = false;
    _sawInaccurate = false;
    _gpsLive = true;
    _lastGpsAt = sample.timestamp;
    _gpsFromSafa = _clamp01(along / lengthM);
    return _current = _compute();
  }

  TrackingReading updateSteps(int total, double t) {
    _nowMs = math.max(_nowMs, t);
    _stepsAtStart ??= total;
    _steps = total;
    return _current = _compute();
  }

  TrackingReading checkStale(double t) {
    _nowMs = math.max(_nowMs, t);
    return _current = _compute();
  }

  TrackingReading gap([double? t]) {
    final at = t ?? TawafTracker._nowMsValue();
    _lastGpsAt = null;
    _gpsLive = false;
    _sawInaccurate = false;
    _refAt = at;
    _nowMs = at;
    _filter.reset();
    return _current = _compute();
  }
}
